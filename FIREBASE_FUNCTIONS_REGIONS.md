# Firebase Functions 部署区域指南

## 🌍 可用的部署区域

Firebase Functions 可以部署在以下区域：

### 美国区域
- **us-central1** (美国中部 - 爱荷华) - **默认区域**
- **us-east1** (美国东部 - 南卡罗来纳)
- **us-east4** (美国东部 - 北弗吉尼亚)
- **us-west1** (美国西部 - 俄勒冈)
- **us-west2** (美国西部 - 洛杉矶)
- **us-west3** (美国西部 - 盐湖城)
- **us-west4** (美国西部 - 拉斯维加斯)

### 欧洲区域
- **europe-west1** (欧洲西部 - 比利时)
- **europe-west2** (欧洲西部 - 伦敦)
- **europe-west3** (欧洲中部 - 法兰克福)
- **europe-west4** (欧洲西部 - 荷兰)
- **europe-west6** (欧洲西部 - 苏黎世)
- **europe-central2** (欧洲中部 - 华沙)

### 亚洲区域
- **asia-east1** (亚洲东部 - 台湾)
- **asia-east2** (亚洲东部 - 香港)
- **asia-northeast1** (亚洲东北部 - 东京)
- **asia-northeast2** (亚洲东北部 - 大阪)
- **asia-northeast3** (亚洲东北部 - 首尔)
- **asia-southeast1** (亚洲东南部 - 新加坡)
- **asia-southeast2** (亚洲东南部 - 雅加达)
- **asia-south1** (亚洲南部 - 孟买)
- **asia-south2** (亚洲南部 - 德里)

### 其他区域
- **southamerica-east1** (南美洲东部 - 圣保罗)
- **southamerica-west1** (南美洲西部 - 圣地亚哥)
- **australia-southeast1** (澳大利亚东南部 - 悉尼)
- **australia-southeast2** (澳大利亚东南部 - 墨尔本)

## 📍 当前配置

### 客户端配置
- **文件**: `creative/common/config/FirebaseFunctionsConfig.swift`
- **当前区域**: `us-central1` (美国中部)
- **默认超时**: 15 秒
- **长超时**: 60 秒

### Functions 部署
- **当前状态**: 未指定区域，默认部署在 `us-central1`

## ⚠️ 为什么请求慢？

### 可能的原因：

1. **区域距离太远**
   - 如果您的用户在中国，访问 `us-central1` 需要跨太平洋，延迟通常在 200-400ms
   - 如果您的用户在欧洲，访问 `us-central1` 延迟通常在 100-200ms

2. **冷启动延迟**
   - Functions 在长时间未使用后会进入休眠状态
   - 首次调用需要冷启动，可能需要 1-5 秒

3. **网络路由问题**
   - 某些地区的网络路由可能不优化
   - 防火墙或网络限制可能影响连接

## 🚀 如何部署到不同区域

### 方法 1: 在代码中指定区域（推荐）

修改每个 Function 文件，添加 `.region()` 调用：

```typescript
// 示例：部署到亚洲东部（台湾）
import * as functions from "firebase-functions/v1";

export const getUserProfile = functions
  .region("asia-east1")  // 添加这一行
  .https.onCall(async (data, context) => {
    // ... 函数代码
  });
```

### 方法 2: 批量修改所有 Functions

在 `functions/src/index.ts` 中，可以创建一个辅助函数：

```typescript
import * as functions from "firebase-functions/v1";

// 定义区域常量
const REGION = "asia-east1"; // 或从环境变量读取

// 创建带区域的 functions 实例
const regionalFunctions = functions.region(REGION);

// 导出时使用 regionalFunctions
export const getUserProfile = regionalFunctions
  .https.onCall(async (data, context) => {
    // ...
  });
```

### 方法 3: 使用环境变量

在 `functions/.env` 或通过 Firebase CLI 设置：

```bash
# 设置环境变量
firebase functions:config:set region.name="asia-east1"

# 在代码中读取
const region = functions.config().region?.name || "us-central1";
```

## 📝 部署步骤

### 1. 选择区域

根据您的用户分布选择：
- **中国用户为主**: `asia-east1` (台湾) 或 `asia-northeast1` (东京)
- **东南亚用户**: `asia-southeast1` (新加坡)
- **欧洲用户**: `europe-west1` (比利时) 或 `europe-west2` (伦敦)
- **美国用户**: `us-central1` (默认) 或 `us-east1`

### 2. 修改 Functions 代码

在需要部署到特定区域的函数中添加 `.region()`：

```typescript
// 示例：getUserProfile.ts
export const getUserProfile = functions
  .region("asia-east1")  // 指定区域
  .https.onCall(async (data, context) => {
    // ... 现有代码
  });
```

### 3. 更新客户端配置

修改 `FirebaseFunctionsConfig.swift`：

```swift
static let region: String = {
    // 改为您部署的区域
    return "asia-east1"  // 或 "asia-northeast1" 等
}()
```

### 4. 部署 Functions

```bash
cd creative-cloud-functions
firebase deploy --only functions
```

## 🔍 验证部署区域

部署后，可以在 Firebase Console 中查看：
1. 打开 Firebase Console
2. 进入 Functions 页面
3. 查看每个函数的区域信息

或在代码中打印：

```typescript
console.log("Function region:", functions.config().region);
```

## ⚡ 性能优化建议

### 1. 多区域部署（高级）

如果用户分布广泛，可以部署多个区域：

```typescript
// 部署到多个区域
export const getUserProfile = functions
  .region("us-central1", "asia-east1", "europe-west1")
  .https.onCall(async (data, context) => {
    // ...
  });
```

客户端根据用户位置动态选择区域。

### 2. 减少冷启动

- 保持函数活跃（定期调用）
- 使用最小内存配置
- 优化代码启动时间

### 3. 使用 CDN 或边缘计算

对于静态内容，考虑使用 Firebase Hosting 或 Cloud CDN。

## 📊 区域延迟参考

| 区域 | 中国用户延迟 | 欧洲用户延迟 | 美国用户延迟 |
|------|------------|------------|------------|
| us-central1 | 200-400ms | 100-200ms | 20-50ms |
| asia-east1 | 50-100ms | 200-300ms | 150-250ms |
| asia-northeast1 | 80-150ms | 250-350ms | 120-200ms |
| europe-west1 | 200-300ms | 20-50ms | 80-150ms |

*注：实际延迟取决于网络条件和路由*

## 🎯 推荐配置

### 如果主要用户在中国：

1. **Functions 部署到**: `asia-east1` (台湾) 或 `asia-northeast1` (东京)
2. **客户端配置**: 修改 `FirebaseFunctionsConfig.swift` 中的 `region` 为 `"asia-east1"`

### 如果主要用户在东南亚：

1. **Functions 部署到**: `asia-southeast1` (新加坡)
2. **客户端配置**: 修改为 `"asia-southeast1"`

### 如果主要用户在欧洲：

1. **Functions 部署到**: `europe-west1` (比利时) 或 `europe-west2` (伦敦)
2. **客户端配置**: 修改为 `"europe-west1"`

## ⚠️ 注意事项

1. **首次部署到新区域需要时间**：可能需要几分钟
2. **成本**：不同区域的定价可能略有不同
3. **数据位置**：确保符合数据存储法规要求
4. **Firestore 区域**：Functions 区域不影响 Firestore 数据位置

## 🔗 相关资源

- [Firebase Functions 区域文档](https://firebase.google.com/docs/functions/locations)
- [Google Cloud Functions 区域列表](https://cloud.google.com/functions/docs/locations)

