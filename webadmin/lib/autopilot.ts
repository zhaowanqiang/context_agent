import "server-only";
import { db } from "./supabase";
import { fetchAllSources } from "./rss";
import { fetchArticle } from "./fetchArticle";
import { scoreNewTopics } from "@/app/actions/topics";
import { autoRunToDraft } from "@/app/actions/runs";
import type { FeedItem } from "./types";

export interface AutopilotReport {
  fetched: string;
  scored: string;
  created: { run_id: string; title: string; ok: boolean; error?: string }[];
  skipped: string[];
}

const SCORE_MIN = Number(process.env.AUTOPILOT_SCORE_MIN ?? 8);
const MAX_RUNS = Number(process.env.AUTOPILOT_MAX_RUNS ?? 2);

/**
 * 全自动产线：抓取 → 打分 → 挑高分选题 → 抓原文 → 建 run → 直通成稿。
 * 产出停在 draft_review（等人核对+发布）——这是刻意保留的最后闸口。
 */
export async function runAutopilot(maxRuns: number = MAX_RUNS): Promise<AutopilotReport> {
  const report: AutopilotReport = { fetched: "", scored: "", created: [], skipped: [] };

  // 1. 抓取全部源
  const fetchResults = await fetchAllSources();
  report.fetched = fetchResults.map((r) => `${r.source}+${r.added}${r.error ? "(失败)" : ""}`).join(" ");

  // 2. 打分
  const scoreRes = await scoreNewTopics();
  report.scored = scoreRes.message ?? scoreRes.error ?? "";

  // 3. 挑高分选题（≥SCORE_MIN 且未使用）。产线只做公众号轨——
  //    X 轨是实测教程，必须有作者一手实测，不适合无人值守生成
  const { data } = await db()
    .from("feed_items")
    .select("*")
    .eq("status", "scored")
    .eq("track", "wechat")
    .gte("score", SCORE_MIN)
    .order("score", { ascending: false })
    .limit(maxRuns * 2); // 多取一倍：原文抓取失败时有备胎
  const candidates = (data ?? []) as FeedItem[];

  // 4. 逐条：抓原文 → 建 run → 直通成稿（串行，控制并发成本）
  for (const item of candidates) {
    if (report.created.filter((c) => c.ok).length >= maxRuns) break;

    const article = await fetchArticle(item.link);
    if (!article) {
      report.skipped.push(`${item.title.slice(0, 30)}（原文抓取失败）`);
      continue;
    }

    const material = [
      `【选题】${item.title}`,
      `【建议角度】${item.suggested_angle ?? "（无）"}`,
      `【原文链接】${item.link}`,
      ``,
      `【原文全文】`,
      article.text,
      ``,
      `【原文图片】`,
      article.images.length > 0 ? article.images.map((u, i) => `${i + 1}. ${u}`).join("\n") : "（原文无可用图片）",
      ``,
      `【我的补充观点】`,
      `（全自动产线生成，无人工补充观点）`,
    ].join("\n");

    const { data: run, error } = await db()
      .from("runs")
      .insert({ track: "wechat", material, feed_item_id: item.id, status: "created" })
      .select("id")
      .single();
    if (error) {
      report.skipped.push(`${item.title.slice(0, 30)}（建 run 失败：${error.message}）`);
      continue;
    }
    await db().from("feed_items").update({ status: "used" }).eq("id", item.id);

    const result = await autoRunToDraft(run.id);
    report.created.push({
      run_id: run.id,
      title: item.title.slice(0, 40),
      ok: !result.error,
      error: result.error,
    });
  }

  return report;
}
