// 证件类型
export type PassportType = "mainland" | "hk_macau_permit" | "overseas";

// 用户想要什么(可多选)
export type Goal = "broker" | "crypto" | "card";

// KYC 难度接受度
export type KycTolerance = "easy_only" | "willing";

// 一条产品就是一条结构化数据 —— 新增产品 = 加一条,不改逻辑代码
export interface Product {
  id: string;
  name: string;
  // 标签:用于和用户"想要什么"做匹配
  tags: Goal[];
  // 是否要求海外地址证明
  requires_overseas_address: boolean;
  // KYC 难度 1(最简单)~ 5(最折腾)
  kyc_difficulty: number;
  // 支持的证件类型
  passport_ok: PassportType[];
  // referral 链接(免费层)。空串 = 没有直达链接(如只能应用商店搜索),
  // UI 隐藏「去开户」按钮、改显示 signup_note
  referral_url: string;
  // 邀请码(有则在卡片上展示,注册时填写可拿新人奖励)
  referral_code?: string;
  // 无直达链接时的开户指引,如「App Store 美区搜 SAVO」
  signup_note?: string;
  // 是否有付费实操教程(决定推荐卡上出现「查看教程」+ 教程页有付费墙)
  has_paid_guide: boolean;
  // 是否有免费全文教程(教程页无付费墙;与 has_paid_guide 互斥)
  has_free_guide?: boolean;
  // 价格(占位,第 1 步不收款)
  paid_price_cny?: number;
  // 一句话:为什么推荐给"你这种情况"
  pitch: string;
  // 坑的标题(免费层只给标题)
  free_pitfalls: string[];
}

// 用户的答题结果
export interface Answers {
  passport: PassportType;
  hasOverseasAddress: boolean;
  goals: Goal[];
  kyc: KycTolerance;
}

// 匹配后的单条结果
export interface ScoredProduct {
  product: Product;
  score: number;
  // 给这条产品打分时累积的"理由"(便于解释,也便于以后调参)
  reasons: string[];
}
