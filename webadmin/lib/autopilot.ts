import "server-only";
import { db } from "./supabase";
import { fetchAllSources } from "./rss";
import { assembleMaterial, fetchSeedContent } from "./material";
import { scoreNewTopics } from "@/app/actions/topics";
import { autoRunToDraft } from "@/app/actions/runs";
import type { FeedItem, Run, TrackId } from "./types";

export interface AutopilotReport {
  track: TrackId;
  ranAt: string;
  fetched: string;
  scored: string;
  /** 本次清掉的卡死 run 数（旧记录无此字段） */
  healed?: number;
  retried: { run_id: string; title: string; ok: boolean }[];
  created: { run_id: string; title: string; ok: boolean; error?: string }[];
  skipped: string[];
}

/**
 * 清尸：把卡在生成态超过 olderThanMinutes 的 run 标记为 failed。
 * 卡死 = 进程中断（关机/休眠/服务重启）留下的尸体——正常单步 LLM 调用 ≤ 320s，
 * 每步完成都会刷新 updated_at，30 分钟没动静必然不是还在跑。
 * 标成 failed 后：run 页出现重试按钮、右侧栏警报可见、产线失败重试会自动补活。
 */
export async function failStuckRuns(track: TrackId, olderThanMinutes = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const { data } = await db()
    .from("runs")
    .update({
      status: "failed",
      error: "生成中断（进程重启/关机），已自动标记失败——产线会自动重试，也可手动重跑",
      updated_at: new Date().toISOString(),
    })
    .eq("track", track)
    .in("status", ["outlining", "drafting", "gating"])
    .lt("updated_at", cutoff)
    .select("id");
  return data?.length ?? 0;
}

const SCORE_MIN = Number(process.env.AUTOPILOT_SCORE_MIN ?? 8);
const MAX_RUNS = Number(process.env.AUTOPILOT_MAX_RUNS ?? 2);

/**
 * 单轨道全自动产线：抓取 → 打分 → 挑高分选题 → 抓原文 → 建 run → 直通成稿。
 * 产出停在 draft_review（等人核对+发布）——这是刻意保留的最后闸口。
 *
 * 轨道差异：公众号轨全部高分选题可进产线；
 * X 轨常规选题是实测教程、必须有作者一手实测，只放行 GitHub 开源库解读
 * （素材来自官方 README，不依赖一手实测）。
 */
export async function runAutopilot(track: TrackId, maxRuns: number = MAX_RUNS): Promise<AutopilotReport> {
  const report: AutopilotReport = {
    track,
    ranAt: new Date().toISOString(),
    fetched: "",
    scored: "",
    retried: [],
    created: [],
    skipped: [],
  };

  // 0a. 清尸：卡死的 *ing run 标 failed，下面的失败重试立刻就能捞起来
  report.healed = await failStuckRuns(track);

  // 0b. 重试近 3 天失败的 run（LLM 超时/瞬时故障/刚清掉的尸体；每次产线最多补 2 个）
  const { data: failedRuns } = await db()
    .from("runs")
    .select("*")
    .eq("track", track)
    .eq("status", "failed")
    .gte("updated_at", new Date(Date.now() - 3 * 86400_000).toISOString())
    .order("updated_at", { ascending: false })
    .limit(2);
  for (const fr of (failedRuns ?? []) as Run[]) {
    const r = await autoRunToDraft(fr.id);
    report.retried.push({ run_id: fr.id, title: (fr.title ?? fr.material.slice(0, 30)) + "", ok: !r.error });
  }

  // 1. 抓取该轨道全部源
  const fetchResults = await fetchAllSources(track);
  report.fetched = fetchResults.map((r) => `${r.source}+${r.added}${r.error ? "(失败)" : ""}`).join(" ");

  // 2. 打分
  const scoreRes = await scoreNewTopics(track);
  report.scored = scoreRes.message ?? scoreRes.error ?? "";

  // 3. 挑高分选题（≥SCORE_MIN 且未使用）
  let q = db()
    .from("feed_items")
    .select("*")
    .eq("status", "scored")
    .eq("track", track)
    .gte("score", SCORE_MIN);
  if (track === "x") q = q.ilike("link", "%github.com%");
  const { data } = await q.order("score", { ascending: false }).limit(maxRuns * 2); // 多取一倍：原文抓取失败时有备胎
  const candidates = (data ?? []) as FeedItem[];

  // 4. 逐条：抓原文 → 建 run → 直通成稿（串行，控制并发成本）
  for (const item of candidates) {
    if (report.created.filter((c) => c.ok).length >= maxRuns) break;

    const content = await fetchSeedContent(item.link);
    if (!content) {
      report.skipped.push(`${item.title.slice(0, 30)}（原文/README 抓取失败）`);
      continue;
    }
    const material = assembleMaterial(item, content, "（全自动产线生成，无人工补充观点）");

    const { data: run, error } = await db()
      .from("runs")
      .insert({ track: item.track, material, feed_item_id: item.id, status: "created" })
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

  // 5. 报告落盘（runs/autopilot/），仪表盘「上次产线」读它
  const { saveReport } = await import("./pipelineLog");
  await saveReport(report);

  return report;
}
