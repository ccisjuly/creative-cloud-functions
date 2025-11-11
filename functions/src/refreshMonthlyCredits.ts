import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {addGiftCredit} from "./credits.js";
import {COLLECTIONS, CREDIT_CONSTANTS} from "./types.js";

const db = admin.firestore();

/**
 * 定时任务：每7天为有激活权益的用户增加 gift_credit
 * 运行时间：每天 00:00 UTC 检查并发放
 *
 * 从 users/{uid} 文档中读取 entitlements 数据
 * 从 credits/{uid} 文档中读取 last_gift_reset 数据
 * 如果距离上次重置已超过7天，则增加点数
 *
 * 注意：
 * - 只给有激活权益的用户发放点数
 * - 用户停止订阅后，不再发放点数（因为 hasActiveEntitlement 为 false）
 * - paid_credit 不受影响，始终保留
 */
export const refreshMonthlyCredits = functions.pubsub
  .schedule("0 0 * * *") // 每天 00:00 UTC 运行
  .timeZone("UTC")
  .onRun(async () => {
    functions.logger.info("🔄 开始执行每7天点数发放任务...");

    try {
      // 获取所有用户文档
      const usersSnapshot = await db
        .collection(COLLECTIONS.USERS)
        .get();

      let processedCount = 0;
      let errorCount = 0;

      // 辅助函数：判断权益是否激活（基于 expires_date）
      const isEntitlementActive = (
        expiresDate: string | null | undefined
      ): boolean => {
        if (!expiresDate) return false;
        try {
          const expiry = new Date(expiresDate);
          return expiry > new Date();
        } catch {
          return false;
        }
      };

      for (const doc of usersSnapshot.docs) {
        const uid = doc.id;
        const userData = doc.data();

        // 检查是否有激活的权益（从 entitlements 字段读取）
        const entitlements = userData.entitlements || {};
        const hasActiveEntitlement = Object.values(entitlements).some(
          (entitlement: unknown) => {
            // 基于 expires_date 判断权益是否激活
            const entitlementData =
              entitlement as Record<string, unknown>;
            return isEntitlementActive(
              entitlementData.expires_date as string | null | undefined
            );
          }
        );

        // 只给有激活权益的用户发放点数
        // 用户停止订阅后，hasActiveEntitlement 为 false，不会进入此分支，停止派发
        if (hasActiveEntitlement) {
          try {
            // 检查 credits 文档，获取上次重置时间
            const creditsRef = db.doc(`${COLLECTIONS.CREDITS}/${uid}`);
            const creditsDoc = await creditsRef.get();

            let shouldAddCredits = false;

            if (!creditsDoc.exists) {
              // 如果 credits 文档不存在，直接发放
              shouldAddCredits = true;
            } else {
              const creditsData = creditsDoc.data() as
                {last_gift_reset?: admin.firestore.Timestamp} | undefined;
              const lastReset = creditsData?.last_gift_reset;

              if (!lastReset) {
                // 如果没有上次重置时间，直接发放
                shouldAddCredits = true;
              } else {
                // 计算距离上次重置的天数
                const lastResetDate = lastReset.toDate();
                const now = new Date();
                const daysSinceReset =
                  Math.floor(
                    (now.getTime() - lastResetDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                  );

                // 如果超过7天，发放点数
                if (daysSinceReset >= 7) {
                  shouldAddCredits = true;
                  functions.logger.info(
                    `⏰ 用户 ${uid} 距离上次重置已 ${daysSinceReset} 天，需要发放点数`
                  );
                } else {
                  functions.logger.info(
                    `⏰ 用户 ${uid} 距离上次重置仅 ${daysSinceReset} 天，跳过`
                  );
                }
              }
            }

            if (shouldAddCredits) {
              await addGiftCredit(
                uid,
                CREDIT_CONSTANTS.WEEKLY_GIFT_CREDIT,
                "weekly_reset"
              );
              processedCount++;
              functions.logger.info(
                `✅ 已为用户 ${uid} 增加 ` +
                `${CREDIT_CONSTANTS.WEEKLY_GIFT_CREDIT} 点 gift_credit`
              );
            }
          } catch (error: unknown) {
            functions.logger.error(
              `❌ 处理用户 ${uid} 的点数失败:`,
              error
            );
            errorCount++;
          }
        } else {
          // 用户没有激活的权益，不发放点数（已停止订阅）
          functions.logger.info(
            `ℹ️ 用户 ${uid} 没有激活的权益，跳过发放点数`
          );
        }
      }

      functions.logger.info(
        `✅ 每7天点数发放任务完成: 处理 ${processedCount} 个用户, 错误 ${errorCount} 个`
      );

      return null;
    } catch (error: unknown) {
      functions.logger.error("❌ 每月点数重置任务失败:", error);
      throw error;
    }
  });
