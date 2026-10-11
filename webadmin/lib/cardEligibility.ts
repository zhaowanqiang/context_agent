import { cardEligibility, type CardEligibility, type Goal, type PassportType } from "@/data/card-eligibility";

/**
 * /cards 3 问推荐的过滤与打分。全站只有这一套权重，要调参就改这个文件。
 * 客户端可 import（纯函数 + 公开数据）。
 */

/** KYC 难度接受度 */
export type KycTolerance = "easy_only" | "willing";

export interface Answers {
  passport: PassportType;
  hasOverseasAddress: boolean;
  goals: Goal[];
  kyc: KycTolerance;
}

export interface ScoredCard {
  product: CardEligibility;
  score: number;
  /** 打分时累积的理由（便于解释，也便于以后调参） */
  reasons: string[];
}

/**
 * 硬过滤的出局原因；null = 通过。
 * 返回原因而不是 boolean：推荐器要向访客解释「为什么这张卡没推给你」，
 * 判断条件只此一份，免得解释和过滤各写一套、迟早漂移。
 */
export function exclusionReason(product: CardEligibility, answers: Answers): string | null {
  // 证件类型必须被支持
  if (!product.passport_ok.includes(answers.passport)) {
    return "不支持你选的证件类型";
  }

  // 需要海外地址但用户没有 —— 出局
  if (product.requires_overseas_address && !answers.hasOverseasAddress) {
    return "需要海外地址证明，你选的是没有";
  }

  // 至少命中用户想要的一类
  if (!product.tags.some((tag) => answers.goals.includes(tag))) {
    return "覆盖的用途和你要的对不上";
  }

  return null;
}

// 打分：分越高排越前
function scoreCard(product: CardEligibility, answers: Answers): ScoredCard {
  let score = 0;
  const reasons: string[] = [];

  // 命中目标的数量（都要的人，覆盖更多需求的卡更靠前）
  const hitGoals = product.tags.filter((tag) => answers.goals.includes(tag));
  score += hitGoals.length * 10;
  if (hitGoals.length > 1) {
    reasons.push("一张就覆盖你多个需求");
  }

  // KYC 偏好
  if (answers.kyc === "easy_only") {
    // 只想要简单的：难度越低加分越多
    score += (5 - product.kyc_difficulty) * 6;
    if (product.kyc_difficulty <= 2) reasons.push("KYC 简单,适合先上车");
  } else {
    // 愿意折腾：轻微偏好功能更强（难度更高）的，但不喧宾夺主
    score += product.kyc_difficulty * 2;
    if (product.kyc_difficulty >= 4) reasons.push("功能更强,值得为它折腾");
  }

  // 不需要海外地址，对没有地址证明的人是实打实的优势
  if (!product.requires_overseas_address && !answers.hasOverseasAddress) {
    score += 8;
    reasons.push("不需要海外地址证明");
  }

  return { product, score, reasons };
}

/** 入口：过滤 → 打分 → 排序 */
export function getRecommendations(answers: Answers): ScoredCard[] {
  return cardEligibility
    .filter((p) => exclusionReason(p, answers) === null)
    .map((p) => scoreCard(p, answers))
    .sort((a, b) => b.score - a.score);
}
