import type { Tier } from "@/lib/decider/entitlements";

// 每个「教程 + 档位」对应一个 Creem 后台创建好的 Product(价格在 Creem 后台配置)。
// checkout 时用 product_id 建单;webhook 靠 metadata 里的 guide_id + tier 反查该给谁解锁。
//
// ⚠️ 上线前:去 Creem 后台为每篇教程的 practical / full 各建一个 Product,
// 把返回的 prod_xxx 填到下面。价格务必和 data/guides.ts 里的 price 对齐。
// 未填(空串)时,checkout 接口会返回明确的配置错误,而不是拿错误 id 去建单。
const CREEM_PRODUCT_IDS: Record<string, string> = {
  "kast:practical": "", // TODO: 填 KAST 实操清单档的 Creem product_id
  "kast:full": "", // TODO: 填 KAST 完整版档的 Creem product_id
  "bybit-card:practical": "", // TODO: 填 Bybit Card 实操清单档的 Creem product_id
  "bybit-card:full": "", // TODO: 填 Bybit Card 完整版档的 Creem product_id
  "wise:practical": "", // TODO: 填 Wise 实操清单档的 Creem product_id
  "wise:full": "", // TODO: 填 Wise 完整版档的 Creem product_id
};

// 查某篇教程某档位对应的 Creem product_id;没配置返回 null(由调用方报配置错误)。
export function getCreemProductId(
  guideId: string,
  tier: Exclude<Tier, "free">
): string | null {
  const id = CREEM_PRODUCT_IDS[`${guideId}:${tier}`];
  return id && id.length > 0 ? id : null;
}
