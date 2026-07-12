import "server-only";
import { agent } from "./agent";
import { parseBriefingItems } from "./briefingItems";
import { searchTopic, type BriefingCandidate } from "./monitorSearch";
import { db } from "./supabase";
import type { MonitorTopic } from "./types";

/**
 * 站内简报产线：多源检索（Google News / Bing News / Reddit / HN，48h 窗口）
 * → 规则闸（关键词预过滤 + 跨期已报去重）→ DeepSeek 按 X 选题价值筛选打分
 * → 落 briefings 表。检索走 smartFetch：直连失败自动回落本地代理 curl。
 */

export type { BriefingCandidate };

export interface BriefingReport {
  ranAt: string;
  topics: number;
  queries: number;
  candidates: number;
  /** 规则层丢弃：语义漂移 + 已报重复 */
  dropped: number;
  bySource: Record<string, number>;
  itemCount: number;
  briefingId: string;
  title: string;
  searchErrors: string[];
}

/** 近三期简报里已报过的链接与摘要行：链接做规则去重，摘要给 LLM 避免复述同一事件 */
async function recentCoverage(): Promise<{ links: Set<string>; summaries: string[] }> {
  // 8 期窗口：连跑测试/补跑会产生空期，3 期窗口曾被空期占满导致漏去重
  const { data } = await db()
    .from("briefings")
    .select("body_md")
    .order("created_at", { ascending: false })
    .limit(8);
  const links = new Set<string>();
  const summaries: string[] = [];
  for (const b of data ?? []) {
    for (const m of b.body_md.matchAll(/https?:\/\/\S+/g)) links.add(m[0].replace(/[>)\]，。]$/, ""));
    for (const m of b.body_md.matchAll(/\*\*摘要\*\*\s*[:：]\s*(.+)/g)) summaries.push(m[1].trim().slice(0, 80));
  }
  return { links, summaries: summaries.slice(0, 30) };
}

export async function runBriefing(): Promise<BriefingReport> {
  const ranAt = new Date().toISOString();
  const { data, error } = await db()
    .from("monitor_topics").select("*").eq("enabled", true)
    .order("position").order("created_at");
  if (error) throw new Error(`读取监控话题失败：${error.message}`);
  const topics = (data ?? []) as MonitorTopic[];
  if (topics.length === 0) throw new Error("没有启用的监控话题——先在 /monitor 添加");

  const recent = await recentCoverage();

  // 话题间串行（限速），话题内四源并行（monitorSearch 负责）
  const candidates: BriefingCandidate[] = [];
  const searchErrors: string[] = [];
  let queries = 0;
  let dropped = 0;
  let rawTotal = 0;
  for (const [i, t] of topics.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 500));
    const r = await searchTopic(t);
    dropped += r.dropped;
    rawTotal += r.raw;
    for (const c of r.items) {
      // 跨期去重：近三期已经报过的链接不再进候选
      if (recent.links.has(c.link)) {
        dropped++;
        continue;
      }
      candidates.push(c);
    }
    searchErrors.push(...r.errors);
    queries += r.queries;
  }
  if (searchErrors.length >= queries && queries > 0) {
    // 一条都没查成（代理挂了等）：直接失败，别产出一期假的「无新动态」
    throw new Error(`检索全部失败：${searchErrors[0]}`);
  }

  const bySource: Record<string, number> = {};
  for (const c of candidates) bySource[c.via] = (bySource[c.via] ?? 0) + 1;

  const dateStr = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD（本地时区）
  const title = `每日简报 - ${dateStr}`;
  let bodyMd: string;
  let itemCount = 0;

  if (candidates.length === 0) {
    bodyMd = "过去48小时内监控话题无新动态。";
  } else {
    const r = await agent.briefing(
      dateStr,
      topics.map((t) => ({ name: t.name, keywords: t.keywords ?? "", note: t.note ?? "" })),
      candidates,
      recent.summaries
    );
    bodyMd = r.text.trim();
    // 用解析器计数（与「转 X 帖」面板同一套逻辑）：字符串 match 会因模型丢前缀而漏计
    itemCount = parseBriefingItems(bodyMd).length;
    // 与产线同款：调用记录进 llm_calls（run_id 空 = 非 run 类调用）
    await db().from("llm_calls").insert({ ...r.call, run_id: null });
  }
  if (searchErrors.length > 0) {
    bodyMd += `\n\n> ⚠️ 部分检索失败（结果可能不全）：${searchErrors.join("；")}`;
  }
  // 检索透明化：尤其零候选时能一眼分清「真无动态」和「检索/过滤出了问题」
  const srcStat = Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join("、");
  bodyMd += `\n\n> 📊 检索：取回 ${rawTotal} 条 → 规则闸拦截 ${dropped}（语义漂移/已报重复）→ 候选 ${candidates.length}${srcStat ? `（${srcStat}）` : ""} → 入选 ${itemCount}`;

  const { data: row, error: insErr } = await db()
    .from("briefings")
    .insert({ title, body_md: bodyMd, item_count: itemCount })
    .select("id")
    .single();
  if (insErr) throw new Error(`简报入库失败：${insErr.message}`);

  return { ranAt, topics: topics.length, queries, candidates: candidates.length, dropped, bySource, itemCount, briefingId: row.id, title, searchErrors };
}
