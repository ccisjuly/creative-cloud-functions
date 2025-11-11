export type EntitlementProduct = {
  active: boolean;
  end?: FirebaseFirestore.Timestamp | null;
  source: "revenuecat";
  quotaRemaining?: number;
};

export type EntitlementsDoc = {
  products?: Record<string, EntitlementProduct>;
  tags?: string[];
  updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
};

export type CreditsDoc = {
  gift_credit: number;
  paid_credit: number;
  last_gift_reset?: FirebaseFirestore.Timestamp | null;
  updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
};

export const COLLECTIONS = {
  USERS: "users",
  ENTITLEMENTS: "entitlements",
  PAYMENTS_RC: "payments/rc",
  CREDITS: "credits",
  TRANSACTIONS: "transactions",
  PRODUCTS: "products",
} as const;

export const RC_EVENT_FIELD = {
  ID: "id",
  EVENT: "event",
  UID: "uid",
  PRODUCT_ID: "productId",
} as const;

export const CREDIT_CONSTANTS = {
  ENTITLEMENT_ACTIVATION_CREDIT: 2, // 会员激活时赠送的点数
  WEEKLY_GIFT_CREDIT: 2, // 会员每7天赠送的点数
  USE_CREDITS_AMOUNT: 5, // 每次使用点数的固定数量（测试用）
  VIDEO_GENERATION_CREDITS: 1, // 视频生成所需点数
  VIDEO_MAX_DURATION_SECONDS: 15, // 视频最大时长（秒）
  VIDEO_MAX_WORD_COUNT: 35, // 视频最大字数（15秒视频约35个词）
} as const;

// 购买点数产品ID映射
export const PURCHASE_CREDIT_MAP: Record<string, number> = {
  "com.sawell.creative.credit.single": 1,
  "com.sawell.creative.credit.10pack": 6,
  "com.sawell.creative.credit.30pack": 13,
} as const;
