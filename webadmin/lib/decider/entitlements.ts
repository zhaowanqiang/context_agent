// 付费等级与内容板块的解锁规则(纯函数,不依赖 Supabase,方便直接单测)。
//
// 三档内容:
//   free      —— 免费结论(简介 / 目录 / 免费步骤),所有人可见
//   practical —— 实操清单(逐步实操详情)
//   full      —— 实操清单 + 避坑清单

export type Tier = "free" | "practical" | "full";

export const TIER_LEVEL: Record<Tier, number> = {
  free: 0,
  practical: 1,
  full: 2,
};

// purchases 表里一行购买记录(只取判定需要的字段)
export interface PurchaseRow {
  guide_id: string;
  tier: string; // 直接来自数据库,可能出现未知值,按无效忽略
}

// 由购买记录算出对某篇教程当前生效的等级:取已购里最高的一档。
// 记录可能包含其他教程的行(调用方查询失误时兜底),这里再按 guideId 过滤一遍。
export function resolveTier(purchases: PurchaseRow[], guideId: string): Tier {
  let best: Tier = "free";
  for (const p of purchases) {
    if (p.guide_id !== guideId) continue;
    const tier = p.tier as Tier;
    if (TIER_LEVEL[tier] === undefined) continue; // 未知等级,忽略
    if (TIER_LEVEL[tier] > TIER_LEVEL[best]) best = tier;
  }
  return best;
}

// 当前等级能否查看需要 required 等级的板块
export function canView(current: Tier, required: Tier): boolean {
  return TIER_LEVEL[current] >= TIER_LEVEL[required];
}
