import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

/**
 * 提交用户反馈
 */
export const submitFeedback = functions
  .region("us-west1")
  .https.onCall(
    async (data, context) => {
    // 验证用户身份
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "User must be authenticated to submit feedback"
        );
      }

      const uid = context.auth.uid;
      const {feedback} = data;

      // 验证反馈内容
      if (!feedback || typeof feedback !== "string" ||
        feedback.trim().length === 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Feedback content is required"
        );
      }

      try {
        const db = admin.firestore();
        const now = admin.firestore.FieldValue.serverTimestamp();

        // 获取用户信息（从 Firestore）
        let userEmail = "";
        let displayName = "";

        try {
          const userDoc = await db.doc(`users/${uid}`).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData?.profile) {
              displayName = userData.profile.displayName || "";
              userEmail = userData.profile.email || "";
            }
          }
        } catch (error) {
        // 如果获取用户信息失败，记录警告但继续处理
          functions.logger.warn(
            `Failed to fetch user profile for ${uid}:`, error);
        }

        // 创建反馈文档
        const feedbackData: Record<string, unknown> = {
          userId: uid,
          userEmail: userEmail,
          displayName: displayName,
          feedback: feedback.trim(),
          createdAt: now,
          status: "pending", // pending, reviewed, resolved
        };

        // 保存到 Firestore
        await db.collection("feedback").add(feedbackData);

        functions.logger.info(
          `✅ Feedback submitted: user ${uid}, ` +
        `feedback length: ${feedback.trim().length}`
        );

        return {
          success: true,
          message: "Feedback submitted successfully",
        };
      } catch (error: unknown) {
        const errorMessage =
        error instanceof Error ? error.message : String(error);
        functions.logger.error(`❌ Error submitting feedback: ${errorMessage}`);
        throw new functions.https.HttpsError(
          "internal",
          `Failed to submit feedback: ${errorMessage}`
        );
      }
    }
  );

