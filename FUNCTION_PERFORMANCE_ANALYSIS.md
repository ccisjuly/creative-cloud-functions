# Firebase Functions 性能分析报告

## 🔍 发现的性能问题

### 1. ⚠️ **严重问题：getUserVideos - 串行外部 API 调用**

**位置**: `functions/src/getUserVideos.ts`

**问题描述**:
- 对于每个 `processing` 状态的视频，都会**串行**调用 HeyGen API 查询状态
- 如果用户有 10 个 processing 视频，会串行执行 10 次外部 API 调用
- 没有并发控制，没有超时控制
- **这是导致请求慢的主要原因**

**代码位置** (第 74-160 行):
```typescript
for (const doc of videoTasksSnapshot.docs) {
  // ...
  if (status === "processing" && config) {
    // 串行调用 HeyGen API - 非常慢！
    const response = await fetch(heygenApiUrl, { ... });
    // ...
  }
}
```

**影响**:
- 如果有 5 个 processing 视频，每个 API 调用需要 1-2 秒，总时间 = 5-10 秒
- 如果有 10 个 processing 视频，总时间 = 10-20 秒
- 用户体验极差

**解决方案**:
1. 使用 `Promise.all()` 并发执行所有 API 调用
2. 添加超时控制（每个请求最多 3 秒）
3. 限制并发数量（最多同时 5 个请求）
4. 考虑批量查询 API（如果 HeyGen 支持）

---

### 2. ⚠️ **getVideoStatus - 每次都调用外部 API**

**位置**: `functions/src/getVideoStatus.ts`

**问题描述**:
- 每次调用 `getVideoStatus` 时，如果状态是 `processing`，都会调用 HeyGen API
- 没有缓存机制
- 如果前端频繁轮询，会导致大量外部 API 调用

**代码位置** (第 64-231 行):
```typescript
if (videoTaskData?.status === "processing") {
  // 每次都调用 HeyGen API
  const response = await fetch(heygenApiUrl, { ... });
}
```

**影响**:
- 每次调用需要 1-2 秒
- 如果前端每 3 秒轮询一次，会产生大量 API 调用

**解决方案**:
1. 添加缓存机制（最近 30 秒内查询过的视频不重复查询）
2. 限制查询频率（同一视频最多每 10 秒查询一次）
3. 使用 Firestore 的 `updated_at` 字段判断是否需要更新

---

### 3. ⚠️ **getAvatars - 没有缓存**

**位置**: `functions/src/getAvatars.ts`

**问题描述**:
- 每次调用都会请求 HeyGen API
- Avatar 列表通常不会频繁变化
- 没有缓存机制

**影响**:
- 每次调用需要 1-3 秒
- 如果多个用户同时打开页面，会产生大量重复的 API 调用

**解决方案**:
1. 使用内存缓存（Node.js 全局变量）
2. 缓存时间：5-10 分钟
3. 或者使用 Firestore 缓存（定期更新）

---

### 4. ⚠️ **getUserProfile - 两次 Firestore 查询**

**位置**: `functions/src/getUserProfile.ts`

**问题描述**:
- 先查询 `users/{uid}` 文档
- 然后查询 `credits/{uid}` 文档
- 两次查询是串行的

**代码位置** (第 31, 65 行):
```typescript
const userSnapshot = await db.doc(`users/${uid}`).get();
// ...
const credits = await getCredits(uid); // 内部又查询一次
```

**影响**:
- 两次串行查询，总时间 = 查询1时间 + 查询2时间
- 通常每个查询需要 50-200ms，总时间 = 100-400ms

**解决方案**:
1. 使用 `Promise.all()` 并发执行两个查询
2. 或者将 credits 数据嵌入到 users 文档中（如果数据量不大）

---

### 5. ⚠️ **scrapeProducts - 多次网络请求**

**位置**: `functions/src/scrapeProducts.ts`

**问题描述**:
- 先尝试 JSON API
- 如果失败，再请求 HTML 页面
- 即使 JSON API 成功，也可能再请求 HTML 来提取描述
- 最多可能进行 2 次网络请求

**代码位置** (第 108-176 行):
```typescript
// 第一次：尝试 JSON API
const jsonResponse = await fetch(jsonUrl, { ... });
// ...
// 第二次：获取 HTML（即使 JSON API 成功）
htmlResponse = await fetch(normalizedUrl, { ... });
```

**影响**:
- 每次网络请求需要 1-3 秒
- 总时间可能达到 2-6 秒

**解决方案**:
1. 优化逻辑：如果 JSON API 成功且包含描述，就不需要再请求 HTML
2. 添加超时控制
3. 考虑使用更快的解析方法

---

### 6. ⚠️ **getUserProducts - 使用 orderBy 但可能缺少索引**

**位置**: `functions/src/getUserProducts.ts`

**问题描述**:
- 使用了 `orderBy("created_at", "desc")`
- 需要复合索引：`uid` + `created_at`
- 如果索引不存在，查询会非常慢

**代码位置** (第 24-28 行):
```typescript
const productsSnapshot = await db
  .collection(COLLECTIONS.PRODUCTS)
  .where("uid", "==", uid)
  .orderBy("created_at", "desc")
  .get();
```

**影响**:
- 如果索引不存在，Firestore 会警告并可能拒绝查询
- 或者查询会非常慢（全表扫描）

**解决方案**:
1. 确认 `firestore.indexes.json` 中有正确的索引
2. 检查 Firebase Console 中的索引状态

---

## 📊 性能问题总结

| 函数 | 问题类型 | 严重程度 | 预估影响 |
|------|---------|---------|---------|
| `getUserVideos` | 串行外部 API 调用 | 🔴 严重 | 10-20 秒（10个视频） |
| `getVideoStatus` | 无缓存，频繁调用 | 🟡 中等 | 1-2 秒/次 |
| `getAvatars` | 无缓存 | 🟡 中等 | 1-3 秒/次 |
| `getUserProfile` | 串行查询 | 🟢 轻微 | 100-400ms |
| `scrapeProducts` | 多次网络请求 | 🟡 中等 | 2-6 秒 |
| `getUserProducts` | 可能缺少索引 | 🟡 中等 | 可能很慢 |

---

## 🚀 优化建议（按优先级排序）

### 优先级 1：修复 getUserVideos（最重要）

```typescript
// 优化后的代码
export const getUserVideos = functions.https.onCall(
  async (data, context) => {
    // ... 前面的代码保持不变 ...

    // 收集所有需要查询的视频
    const processingVideos: Array<{
      doc: admin.firestore.QueryDocumentSnapshot;
      videoId: string;
    }> = [];

    for (const doc of videoTasksSnapshot.docs) {
      const data = doc.data();
      const status = data.status || "unknown";
      if (status === "processing" && config) {
        processingVideos.push({
          doc,
          videoId: doc.id,
        });
      }
    }

    // 并发查询所有 processing 视频的状态
    const statusPromises = processingVideos.map(async ({doc, videoId}) => {
      try {
        const heygenApiUrl =
          `${config.heygenApiBaseUrl}/v1/video_status.get?video_id=${videoId}`;

        // 添加超时控制（3秒）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(heygenApiUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": config.heygenApiKey,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          // ... 处理响应 ...
          // 更新 Firestore（异步，不阻塞）
          doc.ref.update({...}).catch(err => {
            functions.logger.warn(`更新失败: ${err}`);
          });
        }
      } catch (error) {
        // 超时或错误，使用 Firestore 中的数据
        functions.logger.warn(`查询视频 ${videoId} 失败:`, error);
      }
      return null;
    });

    // 等待所有查询完成（最多等待 5 秒）
    await Promise.race([
      Promise.all(statusPromises),
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]);

    // ... 继续处理其他视频 ...
  }
);
```

### 优先级 2：添加缓存机制

```typescript
// 在文件顶部添加缓存
const avatarCache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 分钟

export const getAvatars = functions.https.onCall(
  async (data: {limit?: number} = {}, context) => {
    // 检查缓存
    if (avatarCache && 
        Date.now() - avatarCache.timestamp < CACHE_DURATION) {
      functions.logger.info("✅ 使用缓存的 Avatar 列表");
      return {
        success: true,
        avatars: data.limit ? 
          avatarCache.data.slice(0, data.limit) : 
          avatarCache.data,
        count: data.limit ? 
          Math.min(data.limit, avatarCache.data.length) : 
          avatarCache.data.length,
        total: avatarCache.data.length,
      };
    }

    // 从 API 获取
    // ... 原有代码 ...

    // 更新缓存
    avatarCache = {
      data: avatars,
      timestamp: Date.now(),
    };

    return {
      success: true,
      avatars: finalAvatars,
      count: finalAvatars.length,
      total: avatars.length,
    };
  }
);
```

### 优先级 3：优化 getUserProfile

```typescript
// 并发查询
const [userSnapshot, credits] = await Promise.all([
  db.doc(`users/${uid}`).get(),
  getCredits(uid),
]);
```

### 优先级 4：优化 getVideoStatus

```typescript
// 添加查询频率限制
const lastQueryTime = videoTaskData?.last_api_query_time;
const now = Date.now();

if (videoTaskData?.status === "processing") {
  // 如果最近 10 秒内查询过，跳过 API 调用
  if (lastQueryTime && 
      now - lastQueryTime.toMillis() < 10000) {
    functions.logger.info("跳过 API 查询（最近已查询过）");
    // 直接返回 Firestore 数据
  } else {
    // 调用 API
    // ...
    // 更新 last_api_query_time
    await videoTaskRef.update({
      last_api_query_time: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}
```

---

## 📝 实施步骤

1. **立即修复 getUserVideos**（预计可减少 80% 的响应时间）
2. **添加 getAvatars 缓存**（预计可减少 90% 的重复 API 调用）
3. **优化 getUserProfile**（预计可减少 50% 的响应时间）
4. **添加 getVideoStatus 频率限制**（减少不必要的 API 调用）
5. **检查并创建 Firestore 索引**

---

## 🔧 监控建议

1. 在函数中添加性能日志：
```typescript
const startTime = Date.now();
// ... 执行操作 ...
const duration = Date.now() - startTime;
functions.logger.info(`⏱️ getUserVideos 执行时间: ${duration}ms`);
```

2. 设置 Cloud Functions 的监控告警：
   - 函数执行时间 > 5 秒
   - 函数错误率 > 1%

3. 定期检查 Firebase Console 中的函数性能指标

---

## 📈 预期改进

实施这些优化后，预期改进：

- `getUserVideos`: 从 10-20 秒 → **2-3 秒**（减少 85%）
- `getAvatars`: 从 1-3 秒 → **< 100ms**（缓存命中时）
- `getUserProfile`: 从 200-400ms → **100-200ms**（减少 50%）
- `getVideoStatus`: 减少 70% 的不必要 API 调用

总体 API 响应时间预计可减少 **60-80%**。

