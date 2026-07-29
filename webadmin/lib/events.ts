import "server-only";
import { db } from "@/lib/supabase";

/**
 * 转化埋点：公开层访客的行为落库，回答「钱漏在哪一环」。
 *
 * 设计约束（都是被公开写端点逼出来的）：
 * - /api/track 无鉴权（访客本来就没登录），所以可写内容必须靠白名单封死，
 *   否则任何人都能往表里灌任意 type，面板数据当场作废。
 *   加新事件 = EVENT_TYPES 加一条 + 埋点处调用，两边都得动是刻意的。
 * - 字段一律截断入库：公开端点收到的字符串长度不可信。
 * - 记录失败永不上抛：埋点挂了顶多少一行数据，绝不能让访客那边的
 *   点击/跳转失败——转化本身永远比转化统计重要。
 */

export const EVENT_TYPES = {
  referral_click: "返佣链接点击",
  decider_submit: "答题提交",
  paywall_view: "付费墙曝光",
  buy_click: "购买按钮点击",
} as const;

export type EventType = keyof typeof EVENT_TYPES;

export function isEventType(v: unknown): v is EventType {
  return typeof v === "string" && Object.hasOwn(EVENT_TYPES, v);
}

const MAX_TARGET = 120;
const MAX_PATH = 200;
/** meta 序列化后的上限：正常事件几百字节，超了就是有人在灌数据 */
const MAX_META_BYTES = 2000;

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length === 0 ? null : s.slice(0, max);
}

/** meta 只收对象；过大或非对象一律丢弃（丢 meta 不丢事件，主指标还在） */
function safeMeta(v: unknown): Record<string, unknown> | null {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  try {
    const json = JSON.stringify(v);
    if (json.length > MAX_META_BYTES) return null;
    return v as Record<string, unknown>;
  } catch {
    return null; // 循环引用等
  }
}

export interface EventInput {
  type: EventType;
  target?: unknown;
  path?: unknown;
  meta?: unknown;
}

/** 落一条埋点。永不抛错——返回是否真的写进去了，调用方可以不管。 */
export async function recordEvent(input: EventInput): Promise<boolean> {
  try {
    const { error } = await db().from("events").insert({
      type: input.type,
      target: clip(input.target, MAX_TARGET),
      // query 不入库：埋点表不该成为意外参数（utm、token）的收集器
      path: clip(input.path, MAX_PATH)?.split("?")[0] ?? null,
      meta: safeMeta(input.meta),
    });
    if (error) {
      // events 表还没建时会走到这（增量 SQL 未执行），不该让站点看起来坏了
      console.warn("[events] 落库失败：", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[events] 落库异常：", e instanceof Error ? e.message : e);
    return false;
  }
}

/* ────────────────────────── 面板聚合 ────────────────────────── */

/** 聚合上限：个人站量级远够用；真撞上这个数说明该上真分析工具了 */
const STATS_ROW_CAP = 5000;

export interface ConversionStats {
  days: number;
  /** 各事件类型的计数（白名单里没发生过的也给 0，面板不跳格） */
  counts: Record<EventType, number>;
  /** 返佣点击 top，按次数降序 */
  referrals: { target: string; count: number }[];
  /** 付费墙曝光 → 购买点击 的转化率（0-1）；曝光为 0 时 null */
  paywallRate: number | null;
  /** 答题提交里各目标的选择次数（decider_submit 的 meta.goals） */
  goals: { goal: string; count: number }[];
  /** 数据是否被 STATS_ROW_CAP 截断（截断时数字是低估值，面板要标出来） */
  truncated: boolean;
}

interface EventRow {
  type: string;
  target: string | null;
  meta: Record<string, unknown> | null;
}

/**
 * 最近 N 天的转化概览。表不存在或查询失败时返回 null（面板显示提示，不 500）。
 * 聚合在 JS 里做：Supabase JS 没有 group by，而这点数据量拉回来算更省事。
 */
export async function conversionStats(days = 30): Promise<ConversionStats | null> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  let rows: EventRow[];
  try {
    const { data, error } = await db()
      .from("events")
      .select("type, target, meta")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(STATS_ROW_CAP);
    if (error) return null;
    rows = (data ?? []) as EventRow[];
  } catch {
    return null;
  }

  const counts = Object.fromEntries(
    Object.keys(EVENT_TYPES).map((k) => [k, 0])
  ) as Record<EventType, number>;
  const referrals = new Map<string, number>();
  const goals = new Map<string, number>();

  for (const r of rows) {
    if (isEventType(r.type)) counts[r.type] += 1;
    if (r.type === "referral_click" && r.target) {
      referrals.set(r.target, (referrals.get(r.target) ?? 0) + 1);
    }
    if (r.type === "decider_submit" && Array.isArray(r.meta?.goals)) {
      for (const g of r.meta.goals as unknown[]) {
        if (typeof g === "string") goals.set(g, (goals.get(g) ?? 0) + 1);
      }
    }
  }

  const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;

  return {
    days,
    counts,
    referrals: [...referrals].map(([target, count]) => ({ target, count })).sort(byCount),
    paywallRate:
      counts.paywall_view > 0 ? counts.buy_click / counts.paywall_view : null,
    goals: [...goals].map(([goal, count]) => ({ goal, count })).sort(byCount),
    truncated: rows.length >= STATS_ROW_CAP,
  };
}
