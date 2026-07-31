import { cards, type CryptoCard } from "@/data/crypto-cards";
import { products } from "@/data/decider/products";
import { exclusionReason, getRecommendations } from "@/lib/decider/match";
import type { Answers, Goal, KycTolerance, PassportType, Product } from "@/lib/decider/types";

/**
 * /cards 模块的筛选、排序与推荐。
 *
 * 打分**不在这里重写**：直接调 lib/decider/match.ts 的 getRecommendations，
 * 站里只有一套权重，要调参就去改那一个文件。这里只做两件 match.ts 管不到的事：
 *   ① 把 3 个问题的答案翻译成 match.ts 认的 Answers
 *   ② 把打分结果 join 回加密卡数据，并解释被排除的原因
 *
 * 客户端可 import（不含 server-only，不含付费内容）。
 */

/** slug ↔ products.ts 的 id 一一对应，join 靠它 */
export function productOf(card: CryptoCard): Product | undefined {
  return products.find((p) => p.id === card.slug);
}

/* ───────────────────────── 筛选 ───────────────────────── */

export type FilterId = "all" | "mainland" | "physical" | "applepay";

/** 只列有数据支撑的筛选项：仓库里没有费率来源，「高返现」这类 chip 会永远筛出空 */
export const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "mainland", label: "支持中国大陆" },
  { id: "physical", label: "有实体卡" },
  { id: "applepay", label: "支持 Apple Pay" },
];

export function matchesFilter(card: CryptoCard, filter: FilterId): boolean {
  switch (filter) {
    case "mainland":
      return productOf(card)?.passport_ok.includes("mainland") ?? false;
    // 只有卡面的条目 facts 为 null：一律筛不出来。
    // 这是对的——「有实体卡」是个事实断言，没核实过就不该被筛进来充数。
    case "physical":
      return card.facts?.physicalCard === true;
    case "applepay":
      return card.facts?.applePay === true;
    default:
      return true;
  }
}

/* ───────────────────────── 排序 ───────────────────────── */

// 「热度」和「返现率」都缺数据（没有埋点回流的热度，也没有费率来源），
// 排出来是假的。改用两个真能排的维度。
export type SortId = "default" | "kyc";

export const SORTS: { id: SortId; label: string }[] = [
  { id: "default", label: "推荐顺序" },
  { id: "kyc", label: "KYC 门槛（低→高）" },
];

export function sortCards(list: CryptoCard[], sort: SortId): CryptoCard[] {
  if (sort !== "kyc") return list;
  return [...list].sort(
    (a, b) => (productOf(a)?.kyc_difficulty ?? 99) - (productOf(b)?.kyc_difficulty ?? 99)
  );
}

/* ───────────────────────── 决策器 ───────────────────────── */

export type Usage = "daily" | "subscription" | "withdraw";

export interface HelperAnswers {
  region: PassportType;
  fullKyc: boolean;
  usage: Usage;
}

/** 3 个问题 → match.ts 认的 Answers。用途都落在「卡」上，大额提现额外带上出入金 */
function toDeciderAnswers(a: HelperAnswers): Answers {
  const goals: Goal[] = a.usage === "withdraw" ? ["card", "crypto"] : ["card"];
  const kyc: KycTolerance = a.fullKyc ? "willing" : "easy_only";
  // 决策器不问地址证明（3 问的取舍）。按「没有」代入是保守假设：
  // 需要海外地址的产品会被挡下，不会推给可能开不出来的人。
  return { passport: a.region, hasOverseasAddress: false, goals, kyc };
}

export interface CardRecommendation {
  card: CryptoCard;
  score: number;
  /** 一句话理由，取 match.ts 累积的第一条；没有就退回卡片自己的结论 */
  reason: string;
}

export interface HelperResult {
  top: CardRecommendation[];
  excluded: { card: CryptoCard; reason: string }[];
}

/**
 * 按答案给 Top 2 推荐 + 被排除原因。
 * 权重在 lib/decider/match.ts 的 scoreProduct 里，要调去那儿改。
 */
export function recommendCards(answers: HelperAnswers, list: CryptoCard[] = cards): HelperResult {
  const deciderAnswers = toDeciderAnswers(answers);
  const scored = getRecommendations(deciderAnswers);

  const top: CardRecommendation[] = [];
  const excluded: { card: CryptoCard; reason: string }[] = [];

  for (const card of list) {
    const product = productOf(card);
    if (!product) continue;

    const hit = scored.find((s) => s.product.id === card.slug);
    if (hit) {
      top.push({ card, score: hit.score, reason: hit.reasons[0] ?? card.decision?.verdict ?? "" });
    } else {
      excluded.push({
        card,
        reason: exclusionReason(product, deciderAnswers) ?? "不满足筛选条件",
      });
    }
  }

  top.sort((a, b) => b.score - a.score);
  return { top: top.slice(0, 2), excluded };
}
