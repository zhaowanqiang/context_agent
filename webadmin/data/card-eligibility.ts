/**
 * 加密卡片的开卡条件 —— /cards 的「支持中国大陆」筛选、KYC 排序、3 问推荐和对比表共用这一份。
 *
 * 只收有实测来源的卡（与 data/crypto-cards.ts 里有详情的三张一一对应，靠 id = 卡片 slug 关联）。
 * 骨架卡没有条目：没核实过的开卡条件不写，对应的卡自然不会被筛进来、也不进推荐。
 *
 * 这份数据原先在「出海开户决策」模块的产品表里（还带着券商、定价、教程字段），
 * 该模块下线后只留下 /cards 真正用到的部分。
 *
 * 本文件会被客户端组件 import，只放公开信息。
 */

/** 证件类型 */
export type PassportType = "mainland" | "hk_macau_permit" | "overseas";

/** 用途标签：用于和访客「想要什么」做匹配 */
export type Goal = "crypto" | "card";

export interface CardEligibility {
  /** = data/crypto-cards.ts 里的 slug */
  id: string;
  name: string;
  tags: Goal[];
  /** 是否要求海外地址证明 */
  requires_overseas_address: boolean;
  /** KYC 难度 1（最简单）~ 5（最折腾） */
  kyc_difficulty: number;
  /** 支持的证件类型 */
  passport_ok: PassportType[];
}

export const cardEligibility: CardEligibility[] = [
  {
    id: "kast",
    name: "KAST Visa 稳定币卡",
    tags: ["card", "crypto"],
    requires_overseas_address: false,
    kyc_difficulty: 2,
    passport_ok: ["mainland", "hk_macau_permit", "overseas"],
  },
  {
    id: "bybit-card",
    name: "Bybit Card",
    tags: ["card", "crypto"],
    requires_overseas_address: false,
    kyc_difficulty: 2,
    passport_ok: ["mainland", "hk_macau_permit", "overseas"],
  },
  {
    id: "plasma-one",
    name: "Plasma One",
    tags: ["card", "crypto"],
    requires_overseas_address: false,
    kyc_difficulty: 3,
    passport_ok: ["mainland", "hk_macau_permit", "overseas"],
  },
];
