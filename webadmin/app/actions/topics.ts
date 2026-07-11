"use server";

import { revalidatePath } from "next/cache";
import { agent, AgentError } from "@/lib/agent";
import { fetchAllSources } from "@/lib/rss";
import { db } from "@/lib/supabase";
import type { FeedItem, TrackId } from "@/lib/types";

export interface TopicActionResult {
  error?: string;
  message?: string;
}

async function guard(fn: () => Promise<string>): Promise<TopicActionResult> {
  try {
    return { message: await fn() };
  } catch (e) {
    return { error: e instanceof AgentError || e instanceof Error ? e.message : `${e}` };
  }
}

/** [抓取全部] 按钮（轨道内） */
export async function fetchTopics(track: TrackId): Promise<TopicActionResult> {
  return guard(async () => {
    const results = await fetchAllSources(track);
    revalidatePath(`/agent/${track}/topics`);
    revalidatePath(`/agent/${track}/sources`);
    const ok = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    let msg = `抓取完成：新增 ${ok.reduce((s, r) => s + r.added, 0)} 条（${ok.map((r) => `${r.source} +${r.added}`).join("，")}）`;
    if (failed.length > 0) msg += `；失败：${failed.map((r) => r.source).join("、")}`;
    return msg;
  });
}

/** [AI 打分] 按钮：该轨道 status=new 的条目 20 条一批送对应定位的打分 */
export async function scoreNewTopics(track: TrackId): Promise<TopicActionResult> {
  return guard(async () => {
    // 池卫生：超 7 天仍没轮上打分的条目直接过期——时效题材过了窗口就没有解读价值，
    // 留着只会挤占每次 60 条的打分额度（新条目按 fetched_at 倒序，旧的永远排不上）
    const expireBefore = new Date(Date.now() - 7 * 86400_000).toISOString();
    await db()
      .from("feed_items")
      .update({ status: "discarded", score_reason: "超 7 天未打分，自动过期" })
      .eq("track", track)
      .eq("status", "new")
      .lt("fetched_at", expireBefore);

    const { data, error } = await db()
      .from("feed_items")
      .select("id,title,summary")
      .eq("status", "new")
      .eq("track", track)
      .order("fetched_at", { ascending: false })
      .limit(60); // 单次动作最多 3 批，控制时长和成本
    if (error) throw new Error(error.message);
    const items = (data ?? []) as Pick<FeedItem, "id" | "title" | "summary">[];
    if (items.length === 0) return "没有待打分的新条目";

    // 查重底料：最近 14 天已用/候选的选题标题，同一事件的新候选会被打低分
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();
    const { data: recentRows } = await db()
      .from("feed_items")
      .select("title")
      .eq("track", track)
      .in("status", ["used", "shortlisted"])
      .gte("fetched_at", since)
      .limit(30);
    const recentTitles = (recentRows ?? []).map((r) => r.title as string);

    // 各批之间无依赖（同批查重在批内做，跨批查重靠【最近已用选题】），
    // 3 批并行跑：串行一批 ~40s，并行总时长 ≈ 最慢一批
    const batches: (typeof items)[] = [];
    for (let i = 0; i < items.length; i += 20) batches.push(items.slice(i, i + 20));
    const batchResults = await Promise.all(
      batches.map(async (batchItems) => {
        const batch = batchItems.map((it) => ({
          id: it.id,
          title: it.title,
          summary: it.summary ?? "",
        }));
        const { scores, call } = await agent.scoreTopics(track, batch, recentTitles);
        await db().from("llm_calls").insert({
          run_id: null,
          step: call.step,
          model: call.model,
          prompt: call.prompt,
          response: call.response,
          input_tokens: call.input_tokens,
          output_tokens: call.output_tokens,
        });
        // 一批 20 条并行落库：串行等云端往返一条条写，60 条要白等十几秒
        const results = await Promise.all(
          scores.map((s) =>
            db()
              .from("feed_items")
              .update({
                status: "scored",
                score: s.score,
                suggested_angle: s.angle || null,
                score_reason: s.reason || null,
              })
              .eq("id", s.id)
          )
        );
        return results.filter((r) => !r.error).length;
      })
    );
    const scored = batchResults.reduce((s, n) => s + n, 0);
    revalidatePath(`/agent/${track}/topics`);
    return `已打分 ${scored} 条`;
  });
}

export async function shortlistTopic(id: string, track: TrackId): Promise<TopicActionResult> {
  return guard(async () => {
    const { error } = await db().from("feed_items").update({ status: "shortlisted" }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/agent/${track}/topics`);
    return "已加入候选";
  });
}

export async function discardTopic(id: string, track: TrackId): Promise<TopicActionResult> {
  return guard(async () => {
    const { error } = await db().from("feed_items").update({ status: "discarded" }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/agent/${track}/topics`);
    return "已丢弃";
  });
}
