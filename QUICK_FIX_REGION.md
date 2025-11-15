# 快速修复：将 Functions 部署到亚洲区域

## 🎯 问题
当前 Functions 部署在 `us-central1`（美国中部），如果您的用户在中国，访问延迟会很高（200-400ms）。

## ⚡ 快速解决方案

### 步骤 1: 选择区域

根据您的用户位置选择：
- **中国用户**: `asia-east1` (台湾) - 推荐
- **中国用户（备选）**: `asia-northeast1` (东京)
- **东南亚用户**: `asia-southeast1` (新加坡)

### 步骤 2: 修改所有 Functions 文件

在每个 Function 文件中添加 `.region("asia-east1")`：

**示例：修改 `getUserProfile.ts`**

```typescript
// 修改前
export const getUserProfile = functions
  .https.onCall(async (data, context) => {
    // ...
  });

// 修改后
export const getUserProfile = functions
  .region("asia-east1")  // 添加这一行
  .https.onCall(async (data, context) => {
    // ...
  });
```

### 步骤 3: 需要修改的文件列表

需要修改以下所有 Function 文件：

1. `functions/src/getUserProfile.ts`
2. `functions/src/getUserVideos.ts`
3. `functions/src/getAvatars.ts`
4. `functions/src/getVideoStatus.ts`
5. `functions/src/generateVideo.ts`
6. `functions/src/useCredits.ts`
7. `functions/src/getUserProducts.ts`
8. `functions/src/scrapeProducts.ts`
9. `functions/src/importProduct.ts`
10. `functions/src/updateProduct.ts`
11. `functions/src/deleteProduct.ts`
12. `functions/src/uploadProductImage.ts`
13. `functions/src/getAppConfig.ts`
14. `functions/src/getLocales.ts`
15. `functions/src/getVoices.ts`
16. `functions/src/uploadImage.ts`
17. `functions/src/getUserImages.ts`
18. `functions/src/getUserTransactions.ts`
19. `functions/src/processApplePay.ts`
20. `functions/src/submitFeedback.ts`
21. `functions/src/onUserCreate.ts` (如果使用)
22. `functions/src/refreshMonthlyCredits.ts` (如果使用)
23. `functions/src/onNonSubscriptionPurchase.ts` (如果使用)
24. `functions/src/onEntitlementActivated.ts` (如果使用)
25. `functions/src/refundCredits.ts` (如果使用)

### 步骤 4: 更新客户端配置

修改 `creative/common/config/FirebaseFunctionsConfig.swift`：

```swift
static let region: String = {
    // 改为您部署的区域
    return "asia-east1"  // 或 "asia-northeast1"
}()
```

### 步骤 5: 部署

```bash
cd creative-cloud-functions
npm run build
firebase deploy --only functions
```

## 📊 预期效果

- **延迟降低**: 从 200-400ms 降低到 50-100ms
- **用户体验**: 显著提升响应速度
- **冷启动**: 首次调用可能仍需要 1-2 秒（这是正常的）

## ⚠️ 注意事项

1. **首次部署需要时间**: 部署到新区域可能需要 5-10 分钟
2. **确保客户端同步**: 部署后必须更新客户端配置，否则客户端仍会访问旧区域
3. **测试**: 部署后请测试所有功能是否正常

## 🔍 验证部署

部署后，在 Firebase Console 中：
1. 进入 Functions 页面
2. 查看每个函数的区域信息
3. 应该显示 `asia-east1` 或其他您选择的区域

## 🚀 自动化脚本（可选）

如果您想批量修改所有文件，可以使用以下命令（在 `functions/src` 目录下）：

```bash
# 备份所有文件
find . -name "*.ts" -exec cp {} {}.bak \;

# 使用 sed 批量添加区域（谨慎使用，建议先测试）
# 注意：这需要根据您的代码格式调整
```

**建议**: 手动修改更安全，可以确保代码格式正确。

