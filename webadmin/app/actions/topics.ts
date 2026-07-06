"use server";

import { revalidatePath } from "next/cache";
import { agent, AgentError } from "@/lib/agent";
import { fetchAllSources } from "@/lib/rss";
import { db } from "@/lib/supabase";
import type { FeedItem } from "@/lib/types";

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

/** [抓取全部] 按钮 */
export async function fetchTopics(): Promise<TopicActionResult> {
  return guard(async () => {
    const results = await fetchAllSources();
    revalidatePath("/topics");
    revalidatePath("/sources");
    const ok = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    let msg = `抓取完成：新增 ${ok.reduce((s, r) => s + r.added, 0)} 条（${ok.map((r) => `${r.source} +${r.added}`).join("，")}）`;
    if (failed.length > 0) msg += `；失败：${failed.map((r) => r.source).join("、")}`;
    return msg;
  });
}

/** [AI 打分] 按钮：status=new 的条目按轨道分组、20 条一批送对应定位的打分 */
export async function scoreNewTopics(): Promise<TopicActionResult> {
  return guard(async () => {
    const { data, error } = await db()
      .from("feed_items")
      .select("id,title,summary,track")
      .eq("status", "new")
      .order("fetched_at", { ascending: false })
      .limit(60); // 单次动作最多 3 批，控制时长和成本
    if (error) throw new Error(error.message);
    const items = (data ?? []) as Pick<FeedItem, "id" | "title" | "summary" | "track">[];
    if (items.length === 0) return "没有待打分的新条目";

    let scored = 0;
    for (const track of ["wechat", "x"] as const) {
      const trackItems = items.filter((it) => it.track === track);
      for (let i = 0; i < trackItems.length; i += 20) {
      const batch = trackItems.slice(i, i + 20).map((it) => ({
        id: it.id,
        title: it.title,
        summary: it.summary ?? "",
      }));
      const { scores, call } = await agent.scoreTopics(track, batch);
      await db().from("llm_calls").insert({
        run_id: null,
        step: call.step,
        model: call.model,
        prompt: call.prompt,
        response: call.response,
        input_tokens: call.input_tokens,
        output_tokens: call.output_tokens,
      });
      for (const s of scores) {
        const { error: upErr } = await db()
          .from("feed_items")
          .update({
            status: "scored",
            score: s.score,
            suggested_angle: s.angle || null,
            score_reason: s.reason || null,
          })
          .eq("id", s.id);
        if (!upErr) scored++;
      }
      }
    }
    revalidatePath("/topics");
    return `已打分 ${scored} 条`;
  });
}

export async function shortlistTopic(id: string): Promise<TopicActionResult> {
  return guard(async () => {
    const { error } = await db().from("feed_items").update({ status: "shortlisted" }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/topics");
    return "已加入候选";
  });
}

export async function discardTopic(id: string): Promise<TopicActionResult> {
  return guard(async () => {
    const { error } = await db().from("feed_items").update({ status: "discarded" }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/topics");
    return "已丢弃";
  });
}
