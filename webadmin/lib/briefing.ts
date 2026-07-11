import "server-only";
import Parser from "rss-parser";
import { agent } from "./agent";
import { smartFetch } from "./proxyFetch";
import { db } from "./supabase";
import type { MonitorTopic } from "./types";

/**
 * 站内简报产线（替代 Cowork 方案）：Google News RSS 检索监控话题的 24h 动态
 * → DeepSeek 筛选整理成中文简报 → 落 briefings 表。
 * 检索走 smartFetch：news.google.com 国内直连不通，自动回落本地代理 curl。
 */

const parser = new Parser();

export interface BriefingCandidate {
  topic: string;
  title: string;
  link: string;
  source: string;
  published: string;
  summary: string;
}

export interface BriefingReport {
  ranAt: string;
  topics: number;
  queries: number;
  candidates: number;
  itemCount: number;
  briefingId: string;
  title: string;
  searchErrors: string[];
}

const CJK = /[一-鿿]/;
const MAX_PER_TOPIC = 8;
const FRESH_MS = 26 * 3600_000; // 24h + 时区/抓取误差余量

function gnewsUrl(q: string, zh: boolean): string {
  const query = encodeURIComponent(`${q} when:1d`);
  return zh
    ? `https://news.google.com/rss/search?q=${query}&hl=zh-CN&gl=CN&ceid=CN:zh`
    : `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
}

/** keywords 按 / 拆成检索变体（没配 keywords 用话题名）；单变体时中英各查一次 */
function queriesFor(t: MonitorTopic): { q: string; zh: boolean }[] {
  const variants = (t.keywords ?? t.name).split("/").map((s) => s.trim()).filter(Boolean);
  if (variants.length <= 1) {
    const q = variants[0] ?? t.name;
    return [{ q, zh: false }, { q, zh: true }];
  }
  return variants.map((q) => ({ q, zh: CJK.test(q) }));
}

async function searchTopic(t: MonitorTopic): Promise<{ items: BriefingCandidate[]; queries: number; errors: string[] }> {
  const items: BriefingCandidate[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  const queries = queriesFor(t);
  for (const { q, zh } of queries) {
    try {
      const res = await smartFetch(gnewsUrl(q, zh), 20_000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const feed = await parser.parseString(await res.text());
      for (const it of feed.items ?? []) {
        if (!it.title || !it.link) continue;
        const published = it.isoDate ?? it.pubDate ?? "";
        if (published && Date.now() - new Date(published).getTime() > FRESH_MS) continue;
        // Google News 标题格式「Headline - Publisher」，拆出来源
        const m = it.title.match(/^(.*)\s+-\s+([^-]+)$/);
        const key = (m?.[1] ?? it.title).toLowerCase().replace(/\s+/g, "").slice(0, 80);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
          topic: t.name,
          title: (m?.[1] ?? it.title).trim().slice(0, 200),
          link: it.link,
          source: (m?.[2] ?? "").trim().slice(0, 60),
          published,
          summary: (it.contentSnippet ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
        });
        if (items.length >= MAX_PER_TOPIC) break;
      }
    } catch (e) {
      errors.push(`${t.name}（${q}）：${(e as Error).message}`);
    }
    if (items.length >= MAX_PER_TOPIC) break;
    await new Promise((r) => setTimeout(r, 800)); // 串行限速，别惹 Google
  }
  return { items, queries: queries.length, errors };
}

export async function runBriefing(): Promise<BriefingReport> {
  const ranAt = new Date().toISOString();
  const { data, error } = await db()
    .from("monitor_topics").select("*").eq("enabled", true)
    .order("position").order("created_at");
  if (error) throw new Error(`读取监控话题失败：${error.message}`);
  const topics = (data ?? []) as MonitorTopic[];
  if (topics.length === 0) throw new Error("没有启用的监控话题——先在 /monitor 添加");

  // 逐话题检索（话题内已串行，话题间也串行，总请求 ~12 个）
  const candidates: BriefingCandidate[] = [];
  const searchErrors: string[] = [];
  let queries = 0;
  for (const t of topics) {
    const r = await searchTopic(t);
    candidates.push(...r.items);
    searchErrors.push(...r.errors);
    queries += r.queries;
  }
  if (searchErrors.length === queries) {
    // 一条都没查成（代理挂了等）：直接失败，别产出一期假的「无新动态」
    throw new Error(`检索全部失败：${searchErrors[0]}`);
  }

  const dateStr = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD（本地时区）
  const title = `每日简报 - ${dateStr}`;
  let bodyMd: string;
  let itemCount = 0;

  if (candidates.length === 0) {
    bodyMd = "过去24小时内监控话题无新动态。";
  } else {
    const r = await agent.briefing(
      dateStr,
      topics.map((t) => ({ name: t.name, keywords: t.keywords ?? "", note: t.note ?? "" })),
      candidates
    );
    bodyMd = r.text.trim();
    itemCount = (bodyMd.match(/选题标注/g) ?? []).length;
    // 与产线同款：调用记录进 llm_calls（run_id 空 = 非 run 类调用）
    await db().from("llm_calls").insert({ ...r.call, run_id: null });
  }
  if (searchErrors.length > 0) {
    bodyMd += `\n\n> ⚠️ 部分检索失败（结果可能不全）：${searchErrors.join("；")}`;
  }

  const { data: row, error: insErr } = await db()
    .from("briefings")
    .insert({ title, body_md: bodyMd, item_count: itemCount })
    .select("id")
    .single();
  if (insErr) throw new Error(`简报入库失败：${insErr.message}`);

  return { ranAt, topics: topics.length, queries, candidates: candidates.length, itemCount, briefingId: row.id, title, searchErrors };
}
