import * as functions from "firebase-functions/v1";
import {addPaidCredit} from "./credits.js";

/**
 * Callable 函数：处理 Apple Pay 支付
 *
 * 注意：这是一个基础实现。真实的支付处理需要：
 * 1. 集成支付处理服务（如 Stripe、Square 等）
 * 2. 验证支付令牌
 * 3. 处理实际的资金转移
 *
 * 当前实现仅用于测试，将支付金额转换为点数
 */
export const processApplePay = functions.https.onCall(async (data, context) => {
  // 验证用户是否已登录
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "login required"
    );
  }

  const uid = context.auth.uid;
  const paymentData = data.paymentData; // Base64 编码的支付数据
  const amount = data.amount; // 支付金额（美元）
  const transactionIdentifier = data.transactionIdentifier;

  // 验证参数
  if (!paymentData || typeof paymentData !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "paymentData is required and must be a string"
    );
  }

  if (typeof amount !== "number" || amount <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "amount must be a positive number"
    );
  }

  try {
    // TODO: 在这里集成真实的支付处理服务（如 Stripe）
    // 1. 解码 paymentData（Base64）
    // 2. 将支付数据发送到支付处理服务
    // 3. 等待支付处理服务确认
    // 4. 根据确认结果决定是否继续

    // 示例：使用 Stripe 处理支付
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: Math.round(amount * 100), // 转换为分
    //   currency: 'usd',
    //   payment_method_data: {
    //     type: 'card',
    //     // 使用 paymentData 创建支付方法
    //   },
    // });

    // 当前实现：直接将支付金额转换为点数（1 美元 = 10 点）
    // 注意：这只是测试实现，实际应用中需要先完成真实的支付处理
    const creditsToAdd = Math.round(amount * 10);

    functions.logger.info(
      `处理 Apple Pay 支付: 用户=${uid}, 金额=$${amount}, 交易ID=${transactionIdentifier}`
    );

    // 增加用户点数
    await addPaidCredit(
      uid,
      creditsToAdd,
      undefined, // productId
      transactionIdentifier // purchaseId
    );

    return {
      success: true,
      message: `支付成功！已添加 ${creditsToAdd} 点`,
      creditsAdded: creditsToAdd,
      amount: amount,
    };
  } catch (error: unknown) {
    functions.logger.error(
      `❌ Apple Pay 支付处理失败 (用户: ${uid}, 金额: $${amount}):`,
      error
    );

    const errorMessage =
      error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError(
      "internal",
      `支付处理失败: ${errorMessage}`
    );
  }
});

