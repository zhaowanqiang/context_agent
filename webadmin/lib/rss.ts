import "server-only";
import Parser from "rss-parser";
import { fetchTrendingRows, isGitHubTrendingUrl } from "./github";
import { smartFetch } from "./proxyFetch";
import { db } from "./supabase";
import type { Source } from "./types";

const parser = new Parser();

export interface FetchResult {
  source: string;
  added: number;
  error?: string;
}

async function fetchRssRows(source: Source) {
  // 走 smartFetch：国内源直连，外站源（Reddit/HN 等）自动回落本地代理
  const res = await smartFetch(source.feed_url, 20_000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const feed = await parser.parseString(await res.text());
  return (feed.items ?? [])
    .filter((it) => it.title && it.link)
    .slice(0, 50)
    .map((it) => ({
      source_id: source.id,
      track: source.track,
      guid: it.guid ?? it.link!,
      title: it.title!.trim().slice(0, 300),
      link: it.link!,
      summary: (it.contentSnippet ?? it.content ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
      published_at: it.isoDate ?? null,
    }));
}

/** 抓取单个源并 upsert 进 feed_items（source_id+guid 去重，重复条目忽略） */
export async function fetchSource(source: Source): Promise<FetchResult> {
  try {
    // GitHub trending 源是 HTML 页不是 RSS，走专用解析器
    const rows = isGitHubTrendingUrl(source.feed_url)
      ? await fetchTrendingRows(source)
      : await fetchRssRows(source);

    let added = 0;
    if (rows.length > 0) {
      // ignoreDuplicates: 依赖 unique(source_id, guid)，已有条目不覆盖（保留打分结果）
      const { data, error } = await db()
        .from("feed_items")
        .upsert(rows, { onConflict: "source_id,guid", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      added = data?.length ?? 0;
    }

    await db()
      .from("sources")
      .update({ last_fetched_at: new Date().toISOString(), last_error: null })
      .eq("id", source.id);
    return { source: source.name, added };
  } catch (e) {
    const message = (e as Error).message;
    await db().from("sources").update({ last_error: message }).eq("id", source.id);
    return { source: source.name, added: 0, error: message };
  }
}

/** 抓取指定轨道全部启用的源（串行 + 间隔：Reddit 等外站对并发/高频敏感，容易 429） */
export async function fetchAllSources(track: Source["track"]): Promise<FetchResult[]> {
  const { data, error } = await db()
    .from("sources")
    .select("*")
    .eq("enabled", true)
    .eq("track", track);
  if (error) throw new Error(`读取源失败：${error.message}`);
  const sources = (data ?? []) as Source[];
  const results: FetchResult[] = [];
  for (const s of sources) {
    results.push(await fetchSource(s));
    await new Promise((r) => setTimeout(r, 1200));
  }
  return results;
}
