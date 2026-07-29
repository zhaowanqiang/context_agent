import type { Answers, Product, ScoredProduct } from "@/lib/decider/types";
import { products } from "@/data/decider/products";

/**
 * 硬过滤的出局原因；null = 通过。
 *
 * 原来这里是个只返回 boolean 的 isEligible。改成返回原因，是因为
 * /cards 的决策器要向用户解释「为什么这张卡没推给你」——
 * 若在那边另写一份判断条件，两处规则迟早漂移。判断只此一份。
 */
export function exclusionReason(product: Product, answers: Answers): string | null {
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

function isEligible(product: Product, answers: Answers): boolean {
  return exclusionReason(product, answers) === null;
}

// 打分:分越高排越前。理由数组用于解释 + 以后调参。
function scoreProduct(product: Product, answers: Answers): ScoredProduct {
  let score = 0;
  const reasons: string[] = [];

  // 命中目标的数量(都要的人,覆盖更多需求的产品更靠前)
  const hitGoals = product.tags.filter((tag) => answers.goals.includes(tag));
  score += hitGoals.length * 10;
  if (hitGoals.length > 1) {
    reasons.push("一张就覆盖你多个需求");
  }

  // KYC 偏好
  if (answers.kyc === "easy_only") {
    // 只想要简单的:难度越低加分越多
    score += (5 - product.kyc_difficulty) * 6;
    if (product.kyc_difficulty <= 2) reasons.push("KYC 简单,适合先上车");
  } else {
    // 愿意折腾:轻微偏好功能更强(难度更高)的,但不喧宾夺主
    score += product.kyc_difficulty * 2;
    if (product.kyc_difficulty >= 4) reasons.push("功能更强,值得为它折腾");
  }

  // 不需要海外地址,对没有地址证明的人是实打实的优势
  if (!product.requires_overseas_address && !answers.hasOverseasAddress) {
    score += 8;
    reasons.push("不需要海外地址证明");
  }

  // 有现成的付费实操教程,略微靠前(也是商业目标)
  if (product.has_paid_guide) {
    score += 3;
  }

  return { product, score, reasons };
}

// 入口:过滤 → 打分 → 排序
export function getRecommendations(answers: Answers): ScoredProduct[] {
  return products
    .filter((p) => isEligible(p, answers))
    .map((p) => scoreProduct(p, answers))
    .sort((a, b) => b.score - a.score);
}
