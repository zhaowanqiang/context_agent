/**
 * 海外手机号数据层 —— /numbers 模块的唯一事实来源。
 * 新增/删除一个号码方案 = 改这个文件，组件零改动。
 *
 * ⚠️ 硬约束（与 data/crypto-cards.ts 同源）：
 *
 * 1. **不编造资费、保号规则、政策。** 事实字段一律用 FactValue 三态：
 *    - verified：有官方来源或本人实测，可直接示人
 *    - partial：只核实了一部分，note 必填，写清「已知信息的边界」
 *    - pending：没核实，UI 渲染成斜体「待核实」
 *    没有来源就保持 pending，别为了「填满」写一个看起来合理的数字。
 *
 * 2. **本文件会被客户端组件 import**，只放公开信息。
 *
 * 当前只有 2 条 SAMPLE 条目演示结构，运营商、地区都是占位，
 * 所有事实字段均为 pending——由 @zynqorw 手动填写后删除 SAMPLE 标记。
 */

import type { FactValue } from "@/data/crypto-cards";

export type NumberType = "physical-sim" | "esim" | "virtual";

export const NUMBER_TYPE_LABEL: Record<NumberType, string> = {
  "physical-sim": "实体卡",
  esim: "eSIM",
  virtual: "虚拟号",
};

/** 适合用途：每一项是否可用都是事实判断，同样走 FactValue 三态 */
export type UsageId = "x" | "telegram" | "bank" | "exchange";

export const USAGES: { id: UsageId; label: string }[] = [
  { id: "x", label: "注册 X" },
  { id: "telegram", label: "注册 Telegram" },
  { id: "bank", label: "海外银行" },
  { id: "exchange", label: "交易所" },
];

export interface PhoneNumberEntry {
  /** 唯一标识，用于 URL hash（#number-{slug}） */
  slug: string;
  /** 运营商名称 */
  carrier: string;
  /** 国家/地区 */
  region: string;
  numberType: NumberType;
  /** "pending" = 内容整理中，上线状态本身也未核实 */
  status: "live" | "deprecated" | "pending";
  facts: {
    /** 获取方式（在哪买、要不要实名、怎么寄/激活） */
    acquisition: FactValue;
    /** 保号规则（多久需要一次消费/充值/通话） */
    keepAlive: FactValue;
    /** 最低保号成本 */
    minCost: FactValue;
    /** 能否接收海外平台验证码 */
    overseasSms: FactValue;
  };
  /** 各用途是否适用；缺省的用途按 pending 渲染 */
  usage: Partial<Record<UsageId, FactValue>>;
  /** 我的教程：指向 X 文章（data/x-articles.ts 里的 url）。null = 还没写 */
  tutorialUrl: string | null;
  /** 'YYYY-MM'，人工核对时间，由人提供，不允许自动填当前日期。null = 从未核对 */
  lastVerified: string | null;
}

const PENDING: FactValue = { status: "pending" };

export const phoneNumbers: PhoneNumberEntry[] = [
  // SAMPLE — 待替换：运营商、地区为占位，所有事实字段待填写
  {
    slug: "sample-a",
    carrier: "【示例】运营商 A",
    region: "PLACEHOLDER 地区",
    numberType: "physical-sim",
    status: "pending",
    facts: { acquisition: PENDING, keepAlive: PENDING, minCost: PENDING, overseasSms: PENDING },
    usage: {},
    tutorialUrl: null,
    lastVerified: null,
  },
  // SAMPLE — 待替换
  {
    slug: "sample-b",
    carrier: "【示例】运营商 B",
    region: "PLACEHOLDER 地区",
    numberType: "esim",
    status: "pending",
    facts: { acquisition: PENDING, keepAlive: PENDING, minCost: PENDING, overseasSms: PENDING },
    usage: {},
    tutorialUrl: null,
    lastVerified: null,
  },
];
