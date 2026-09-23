/**
 * 返佣链接注册表 —— 全站返佣位的唯一事实来源。
 *
 * 在此之前返佣链接散在三个地方：data/decider/products.ts（金融产品）、
 * data/crypto-cards.ts（卡面邀请码）、以及教程正文里手写的裸链。
 * 结果是同一个链接改一次要翻三个文件，而且教程正文里的裸链既不带
 * rel="sponsored" 也不落埋点——点了多少次根本不知道。
 *
 * 现在：产品只在这里定义一次，正文用 ::referral{id=xxx} 标记引用，
 * 文末卡 / /deals 汇总页 / 教程内嵌全部从这里读，埋点统一走 referral_click。
 *
 * ⚠️ 两条硬约束，跟 data/crypto-cards.ts 同源：
 *
 * 1. **本文件会被客户端组件 import**，只放公开信息，不放付费内容、不放密钥。
 *
 * 2. **不编造价格、优惠、返现。** 没亲手核实过的数字一律不写——
 *    `perk` 留空好过写一个"首年 $10.99"然后访客点进去发现是 $16.98。
 *    返佣位骗一次点击，教程页攒的信任就全没了，这买卖不划算。
 *    需要人来填的字段用 TODO 标出，一眼能扫出还欠什么。
 */

export type ReferralCategory = "account" | "server" | "esim" | "ai";

export interface ReferralCategoryMeta {
  id: ReferralCategory;
  label: string;
  /** 列表页筛选条 + /deals 分组标题下的一句话 */
  blurb: string;
}

/** 品类：教程库和 /deals 共用一套，加品类 = 这里加一条 */
export const REFERRAL_CATEGORIES: ReferralCategoryMeta[] = [
  { id: "account", label: "出海账户 / 卡", blurb: "跨境收付、多币种账户、加密支付卡" },
  { id: "server", label: "服务器 / 建站", blurb: "VPS、域名、部署——自建服务的底座" },
  { id: "esim", label: "eSIM / 号码", blurb: "境外上网卡、保号卡、接码用的号码" },
  { id: "ai", label: "AI 工具", blurb: "订阅、API、效率工具" },
];

export interface Referral {
  id: string;
  name: string;
  category: ReferralCategory;
  emoji: string;
  /**
   * 返佣 / 邀请链接。空串 = 还没拿到链接。
   * 公开层一律走 activeReferrals() 过滤，空链接不会渲染成死按钮。
   */
  url: string;
  /** 邀请码：有的产品没有直达链接，只能手填码（如 SAVO） */
  code?: string;
  /** 一句话：这是什么、解决谁的什么问题 */
  pitch: string;
  /**
   * 走我的链接你能多拿什么。**只写核实过的**，没核实就留空——
   * 卡片会自动省掉这一行，不会显示"优惠：undefined"。
   */
  perk?: string;
  /** 没有直达链接时的开通指引 */
  note?: string;
  /** 站内教程 slug：有就在卡片上多给一个「看教程」次要入口 */
  guideSlug?: string;
}

/**
 * 全部返佣产品。链接与 data/decider/products.ts、data/crypto-cards.ts 保持一致，
 * 改链接改这里（那两处的 referral_url 后续会逐步指回本表）。
 */
export const REFERRALS: Referral[] = [
  /* ── 出海账户 / 卡 ─────────────────────────────────────── */
  {
    id: "wise",
    name: "Wise 多币种账户",
    category: "account",
    emoji: "🌐",
    url: "https://wise.com/invite/ilpc/zhaowanqiangz1",
    pitch: "大陆身份证即可开，40+ 币种真实汇率；验证过的大陆账户还能申请香港 DBS 港币账户。",
    perk: "通过邀请链接注册，可获得最高 US$600 的免手续费汇款额度",
    guideSlug: "wise-account",
  },
  {
    id: "kast",
    name: "KAST Visa 稳定币卡",
    category: "account",
    emoji: "💳",
    url: "https://app.kast.xyz/referral/O0J1Z2AL",
    code: "O0J1Z2AL",
    pitch: "无需海外地址、KYC 相对友好，大陆护照先上车的一张稳定币卡。",
    perk: "注册时填邀请码可拿新人积分",
    guideSlug: "kast-card",
  },
  {
    id: "bybit-card",
    name: "Bybit Card",
    category: "account",
    emoji: "🟡",
    url: "https://bybit.com/cards/?ref=RRBQBG1&source=applet_invite",
    code: "RRBQBG1",
    pitch: "全程约 5 分钟开卡，订阅 Claude / ChatGPT 这类 AI 服务很顺手。",
    // perk 留空：首月返现比例是活动价，会变，不写死
    guideSlug: "bybit-card",
  },
  {
    id: "savo",
    name: "SAVO Visa 借记卡",
    category: "account",
    emoji: "🪪",
    url: "", // 没有直达邀请链接，只能手填码
    code: "51L5Y",
    pitch: "新加坡 XFERS 发行，大陆护照一级 KYC 即可开基础卡，门槛最低的一张。",
    perk: "注册时填邀请码可免掉 5 美元开卡费",
    note: "App Store / Google Play 切美区后搜 SAVO 下载，注册时务必填邀请码",
    guideSlug: "savo-card",
  },

  /* ── 服务器 / 建站 ─────────────────────────────────────── */
  {
    id: "racknerd",
    name: "RackNerd VPS",
    category: "server",
    emoji: "🖥️",
    // TODO(@zynqorw): 填你的 RackNerd 联盟链接（后台 Affiliates → Your Referral URL）。
    // 空串期间本条不会出现在任何公开页面，填上即自动上线。
    url: "",
    pitch: "低价年付 VPS，跑小服务、自建代理、挂脚本够用——我自己的几台常驻机就在这。",
    // TODO(@zynqorw): perk 写你核实过的当期优惠（如「年付套餐 + 优惠码 X」）。
    // 不确定就留空——写错的优惠比没有优惠更伤信任。
    guideSlug: "racknerd-vps",
  },

  /* ── eSIM / 号码 ───────────────────────────────────────── */
  {
    id: "xesim",
    name: "Xesim eSIM",
    category: "esim",
    emoji: "📶",
    // TODO(@zynqorw): 填你的 Xesim 推广链接 / 邀请码。空串期间不公开渲染。
    url: "",
    pitch: "境外上网 eSIM，扫码即用，不用换实体卡；出境短期用比开漫游省事。",
    guideSlug: "xesim-esim",
  },
];

/** 返佣披露：所有出现返佣位的页面都要挂这一句（合规，也是对读者的基本交代） */
export const REFERRAL_DISCLOSURE =
  "本页含返佣链接：通过它们下单我会拿到一笔佣金，你的价格不会因此变高（有优惠时反而更低）。推荐的都是我自己在用的，拿不拿佣金不影响我写什么。";

const byId = new Map(REFERRALS.map((r) => [r.id, r]));

export function getReferral(id: string): Referral | undefined {
  return byId.get(id);
}

/**
 * 公开层可渲染的返佣产品：链接和邀请码至少得有一个，否则卡片上没有任何
 * 可执行动作，等于放了个死按钮。TODO 未填的条目就是靠这里挡住的。
 */
export function activeReferrals(category?: ReferralCategory): Referral[] {
  return REFERRALS.filter(
    (r) => (r.url !== "" || r.code) && (category === undefined || r.category === category)
  );
}

export function isActive(r: Referral): boolean {
  return r.url !== "" || Boolean(r.code);
}

/** 目标教程没上站时去掉 guideSlug，卡片就不渲染指向 404 的「看教程」 */
export function withLiveGuide(r: Referral, published: Set<string>): Referral {
  return r.guideSlug && !published.has(r.guideSlug) ? { ...r, guideSlug: undefined } : r;
}

export function categoryMeta(id: ReferralCategory): ReferralCategoryMeta | undefined {
  return REFERRAL_CATEGORIES.find((c) => c.id === id);
}
