import * as functions from "firebase-functions/v1";
import {CREDIT_CONSTANTS} from "./types.js";
import {getConfig} from "./config.js";

/**
 * 获取应用配置信息（包括点数相关配置）
 * 前端可以通过此函数获取点数配置，避免硬编码
 */
export const getAppConfig = functions.https.onCall(async () => {
  // 不需要验证用户身份，配置信息是公开的
  try {
    const config = await getConfig();

    return {
      success: true,
      config: {
        // 点数相关配置
        credits: {
          // 视频生成所需点数
          videoGenerationRequired: CREDIT_CONSTANTS.VIDEO_GENERATION_CREDITS,
          // 视频最大时长（秒）
          videoMaxDurationSeconds:
            CREDIT_CONSTANTS.VIDEO_MAX_DURATION_SECONDS,
          // 视频最大字数（15秒视频约35个词）
          videoMaxWordCount: CREDIT_CONSTANTS.VIDEO_MAX_WORD_COUNT,
          // 每次使用点数的固定数量（用于测试等场景）
          useCreditsAmount: CREDIT_CONSTANTS.USE_CREDITS_AMOUNT,
          // 会员激活时赠送点数
          entitlementActivationCredit:
            CREDIT_CONSTANTS.ENTITLEMENT_ACTIVATION_CREDIT,
          // 会员每7天赠送点数
          weeklyGiftCredit: CREDIT_CONSTANTS.WEEKLY_GIFT_CREDIT,
        },
        // 其他配置可以在这里添加
        heyGen: {
          apiKey: config.heygenApiKey ? "***" : null, // 不返回真实的 API Key
        },
      },
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    functions.logger.error(`❌ Error getting app config: ${errorMessage}`);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to get app config: ${errorMessage}`
    );
  }
});

