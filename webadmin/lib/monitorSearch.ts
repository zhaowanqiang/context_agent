import "server-only";
import Parser from "rss-parser";
import { proxyFetch, smartFetch } from "./proxyFetch";
import type { MonitorTopic } from "./types";

/**
 * 监控话题多源检索：Google News + Bing News + Reddit + Hacker News。
 * 为什么多源——小众话题（加密支付卡产品、开户政策）不上主流新闻，
 * 真正的信号在 Reddit/HN 社区帖；单靠 Google News 曾导致「根本监控不到」。
 * 每个源独立容错：一个源挂了不影响其他源。
 */

export interface BriefingCandidate {
  topic: string;
  title: string;
  link: string;
  source: string;
  published: string;
  summary: string;
  via: "GoogleNews" | "BingNews" | "Reddit" | "HackerNews";
}

export interface TopicSearchResult {
  items: BriefingCandidate[];
  queries: number;
  errors: string[];
  /** 各源取回的原始条数（新鲜度过滤后、预过滤前）——零候选时排查用 */
  raw: number;
  /** 预过滤丢弃数（关键词不命中，语义漂移的沾边条目） */
  dropped: number;
}

const CJK = /[一-鿿]/;
/** 48h 窗口：24h 对小众话题太窄常年空手而归；跨期重复靠已报链接去重兜底 */
export const FRESH_MS = 48 * 3600_000;
const MAX_PER_TOPIC = 10;
const MAX_VARIANTS = 3;

const parser = new Parser({
  customFields: { item: [["News:Source", "newsSource"]] },
});

function fresh(published: string | undefined): boolean {
  if (!published) return false; // 无时间戳的一律丢：Bing 会返回几年前的旧文
  const t = new Date(published).getTime();
  return Number.isFinite(t) && Date.now() - t <= FRESH_MS;
}

/** keywords 按 / 拆成检索变体（没配 keywords 用话题名），最多 3 个 */
export function variantsFor(t: MonitorTopic): string[] {
  const list = (t.keywords ?? t.name).split("/").map((s) => s.trim()).filter(Boolean);
  return (list.length > 0 ? list : [t.name]).slice(0, MAX_VARIANTS);
}

// ── 相关性预过滤 ─────────────────────────────────────────────────────
// Google News 会做语义扩展，「跨境多币种账户」能搜出人民币国际化宏观新闻。
// 规则闸：标题+摘要必须真的命中话题词——整词组命中，或多词变体命中 ≥2 个显著 token。

const STOP_TOKENS = new Set(["card", "cards", "account", "accounts", "with", "from", "that", "this", "und", "the"]);

function tokensOf(variant: string): string[] {
  return variant
    .toLowerCase()
    .split(/[\s,;·，、]+/)
    .flatMap((w) => (CJK.test(w) ? w.match(/[一-鿿]{2,}/g) ?? [] : [w]))
    .filter((w) => (CJK.test(w) ? w.length >= 2 : w.length >= 4) && !STOP_TOKENS.has(w));
}

export function matchesTopic(text: string, t: MonitorTopic): boolean {
  const hay = text.toLowerCase();
  for (const v of [t.name, ...variantsFor(t)]) {
    const phrase = v.toLowerCase().trim();
    if (phrase && hay.includes(phrase)) return true;
    const tokens = tokensOf(v);
    if (tokens.length === 0) continue;
    const hits = tokens.filter((tok) => hay.includes(tok)).length;
    if (hits >= Math.min(2, tokens.length)) return true;
  }
  return false;
}

// ── 各源 adapter：统一返回 BriefingCandidate[]，内部只做「取回 + 规整 + 新鲜度」──

async function searchGoogleNews(topic: string, q: string, zh: boolean): Promise<BriefingCandidate[]> {
  const query = encodeURIComponent(`${q} when:2d`);
  const url = zh
    ? `https://news.google.com/rss/search?q=${query}&hl=zh-CN&gl=CN&ceid=CN:zh`
    : `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  const res = await smartFetch(url, 20_000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const feed = await parser.parseString(await res.text());
  const out: BriefingCandidate[] = [];
  for (const it of feed.items ?? []) {
    if (!it.title || !it.link || !fresh(it.isoDate ?? it.pubDate)) continue;
    // Google News 标题格式「Headline - Publisher」，拆出来源
    const m = it.title.match(/^(.*)\s+-\s+([^-]+)$/);
    out.push({
      topic,
      title: (m?.[1] ?? it.title).trim().slice(0, 200),
      link: it.link,
      source: (m?.[2] ?? "Google News").trim().slice(0, 60),
      published: it.isoDate ?? it.pubDate ?? "",
      summary: (it.contentSnippet ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
      via: "GoogleNews",
    });
  }
  return out;
}

async function searchBingNews(topic: string, q: string): Promise<BriefingCandidate[]> {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS`;
  // 国内直连 bing.com 会 200 但重定向到 cn.bing 首页（非 RSS 软失败），
  // smartFetch 的失败回落对此无感——先试直连，内容不对就强制代理重取
  let res = await smartFetch(url, 20_000);
  let text = res.ok ? await res.text() : "";
  if (!res.ok || !text.trimStart().startsWith("<?xml")) {
    res = await proxyFetch(url, 20_000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
    if (!text.trimStart().startsWith("<?xml")) throw new Error("代理路径仍返回非 RSS");
  }
  const feed = await parser.parseString(text);
  const out: BriefingCandidate[] = [];
  for (const it of feed.items ?? []) {
    if (!it.title || !it.link || !fresh(it.isoDate ?? it.pubDate)) continue;
    // apiclick.aspx 中转链接里带原文 URL（url= 参数）——解出直链，X 帖可直接引用
    let link = it.link;
    try {
      link = new URL(it.link).searchParams.get("url") ?? it.link;
    } catch { /* 保留原链接 */ }
    out.push({
      topic,
      title: it.title.trim().slice(0, 200),
      link,
      source: ((it as { newsSource?: string }).newsSource ?? "Bing News").trim().slice(0, 60),
      published: it.isoDate ?? it.pubDate ?? "",
      summary: (it.contentSnippet ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
      via: "BingNews",
    });
  }
  return out;
}

// Reddit 全局限速：请求都经共享代理出口 IP，一分钟十几个请求必撞 429。
// 模块级时间戳闸 + 429 一次退避重试；话题串行跑，这里天然无并发竞争。
let lastRedditAt = 0;
// 实测 2.5s 间隔 + 6s 退避仍 3/6 撞 429（共享代理出口配额极紧）——10s/20s 才稳。
// 6 话题多花约 1 分钟，简报是定时任务，换社区信号值得。
const REDDIT_GAP_MS = 10_000;

async function redditFetch(url: string): Promise<Response> {
  const wait = lastRedditAt + REDDIT_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRedditAt = Date.now();
  let res = await smartFetch(url, 20_000);
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 20_000));
    lastRedditAt = Date.now();
    res = await smartFetch(url, 20_000);
  }
  return res;
}

async function searchReddit(topic: string, q: string): Promise<BriefingCandidate[]> {
  // t=week + 自己按 48h 过滤：t=day 常空手，宁可多取再筛
  const url = `https://old.reddit.com/search.rss?q=${encodeURIComponent(q)}&sort=new&t=week&limit=25`;
  const res = await redditFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const feed = await parser.parseString(await res.text());
  const out: BriefingCandidate[] = [];
  for (const it of feed.items ?? []) {
    if (!it.title || !it.link || !fresh(it.isoDate ?? it.pubDate)) continue;
    const sub = it.link.match(/\/r\/([^/]+)\//)?.[1];
    out.push({
      topic,
      title: it.title.trim().slice(0, 200),
      link: it.link,
      source: sub ? `Reddit r/${sub}` : "Reddit",
      published: it.isoDate ?? it.pubDate ?? "",
      summary: (it.contentSnippet ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
      via: "Reddit",
    });
  }
  return out;
}

interface HNHit {
  title?: string;
  url?: string | null;
  objectID: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
}

async function searchHackerNews(topic: string, q: string): Promise<BriefingCandidate[]> {
  const since = Math.floor((Date.now() - FRESH_MS) / 1000);
  const url =
    `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}` +
    `&tags=story&hitsPerPage=10&numericFilters=created_at_i>${since}`;
  const res = await smartFetch(url, 15_000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { hits?: HNHit[] };
  return (data.hits ?? [])
    .filter((h) => h.title)
    .map((h) => ({
      topic,
      title: h.title!.trim().slice(0, 200),
      link: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      source: "Hacker News",
      published: h.created_at ?? "",
      summary: `HN 帖子：${h.points ?? 0} 点赞 · ${h.num_comments ?? 0} 条评论`,
      via: "HackerNews" as const,
    }));
}

// ── 话题级编排：源间并行、源内变体串行，预过滤 + 跨源去重 ────────────────

export async function searchTopic(t: MonitorTopic): Promise<TopicSearchResult> {
  const variants = variantsFor(t);
  const zhVariants = variants.filter((v) => CJK.test(v));
  const enVariants = variants.filter((v) => !CJK.test(v));
  // 中文变体只有 Google News 覆盖得动；英文变体四源全查
  const plans: { name: string; run: () => Promise<BriefingCandidate[]> }[] = [];
  const serial = (name: string, qs: string[], fn: (q: string) => Promise<BriefingCandidate[]>) => {
    if (qs.length === 0) return;
    plans.push({
      name,
      run: async () => {
        const all: BriefingCandidate[] = [];
        for (const [i, q] of qs.entries()) {
          if (i > 0) await new Promise((r) => setTimeout(r, 800));
          all.push(...(await fn(q)));
        }
        return all;
      },
    });
  };
  serial("GoogleNews", [...enVariants, ...zhVariants].slice(0, MAX_VARIANTS), (q) =>
    searchGoogleNews(t.name, q, CJK.test(q))
  );
  serial("BingNews", enVariants.slice(0, 2), (q) => searchBingNews(t.name, q));
  // Reddit 只查 1 个变体：共享代理出口撞限流的代价远大于多一个变体的召回
  serial("Reddit", enVariants.slice(0, 1), (q) => searchReddit(t.name, q));
  serial("HackerNews", enVariants.slice(0, 1), (q) => searchHackerNews(t.name, q));

  const settled = await Promise.allSettled(plans.map((p) => p.run()));
  const errors: string[] = [];
  const raw: BriefingCandidate[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") raw.push(...r.value);
    else errors.push(`${t.name}（${plans[i].name}）：${(r.reason as Error).message}`);
  });

  // 预过滤（语义漂移拦截）+ 跨源标题去重 + 截断
  const seen = new Set<string>();
  const items: BriefingCandidate[] = [];
  let dropped = 0;
  for (const c of raw) {
    if (!matchesTopic(`${c.title} ${c.summary}`, t)) {
      dropped++;
      continue;
    }
    const key = c.title.toLowerCase().replace(/\s+/g, "").slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(c);
    if (items.length >= MAX_PER_TOPIC) break;
  }
  return { items, queries: plans.length, errors, raw: raw.length, dropped };
}
