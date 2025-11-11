import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {COLLECTIONS} from "./types.js";

export const onUserCreate = functions
  .auth.user().onCreate(async (user) => {
    const db = admin.firestore();
    const {uid, email, displayName, photoURL} = user;
    const now = admin.firestore.FieldValue.serverTimestamp();

    // 记录用户创建信息（特别是邮箱）
    functions.logger.info(
      `✅ New user created: UID=${uid}, Email=${email || "none"}, ` +
      `DisplayName=${displayName || "none"}`
    );

    // 确保邮箱被保存（对于邮箱注册的用户，email 应该存在）
    const userEmail = email || "";
    if (!userEmail) {
      functions.logger.warn(
        `⚠️ User ${uid} created without email address`
      );
    }

    await db.doc(`${COLLECTIONS.USERS}/${uid}`).set({
      profile: {
        displayName: displayName || "",
        email: userEmail, // 保存邮箱（即使是空字符串）
        photoURL: photoURL || "",
      },
      roles: {super_admin: false},
      updatedAt: now,
      // entitlements, subscriptions, non_subscriptions 等字段
      // 由 RevenueCat Extension 自动管理
    }, {merge: true});

    functions.logger.info(
      `✅ User profile saved to Firestore: UID=${uid}, Email=${userEmail}`
    );

    // 初始化点数文档
    await db.doc(`${COLLECTIONS.CREDITS}/${uid}`).set({
      gift_credit: 0,
      paid_credit: 0,
      updatedAt: now,
    }, {merge: true});
  });
