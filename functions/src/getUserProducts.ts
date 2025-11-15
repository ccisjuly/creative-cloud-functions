import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {COLLECTIONS} from "./types.js";

/**
 * 获取用户商品列表
 */
export const getUserProducts = functions
  .region("us-west1")
  .https.onCall(
    async (data, context) => {
    // 验证用户身份
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "User must be authenticated"
        );
      }

      const uid = context.auth.uid;

      try {
        const db = admin.firestore();

        // 查询用户的所有商品，按创建时间倒序
        const startTime = Date.now();
        const productsSnapshot = await db
          .collection(COLLECTIONS.PRODUCTS)
          .where("uid", "==", uid)
          .orderBy("created_at", "desc")
          .get();
        const queryTime = Date.now() - startTime;

        // 映射商品数据（Firestore 查询已经过滤了 uid，不需要再次过滤）
        const products = productsSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || "",
              description: data.description || null,
              price: data.price || null, // 向后兼容
              currency: data.currency || null,
              amount: data.amount || null,
              imageUrl: data.image_url || null,
              images: data.images || null,
              url: data.url || "",
              platform: data.platform || "shopify",
              uid: data.uid || null,
              createdAt: data.created_at?.toDate?.()?.toISOString() || null,
              updatedAt: data.updated_at?.toDate?.()?.toISOString() || null,
            };
          });

        const totalTime = Date.now() - startTime;
        functions.logger.info(
          `⏱️ getUserProducts 执行时间: ${totalTime}ms ` +
          `(查询: ${queryTime}ms, 用户: ${uid}, 数量: ${products.length})`
        );

        return {
          success: true,
          products: products,
          count: products.length,
          message: `Found ${products.length} product(s)`,
        };
      } catch (error: unknown) {
        const errorMessage =
        error instanceof Error ? error.message : String(error);
        functions.logger.error(
          `❌ Error getting user products: ${errorMessage}`
        );
        return {
          success: false,
          products: null,
          count: 0,
          error: errorMessage,
          message: "Failed to get user products",
        };
      }
    }
  );

