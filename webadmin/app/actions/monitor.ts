"use server";

import { revalidatePath } from "next/cache";
import { agent } from "@/lib/agent";
import { runBriefing, type BriefingReport } from "@/lib/briefing";
import { itemToMaterial, parseBriefingItems } from "@/lib/briefingItems";
import { db } from "@/lib/supabase";

export interface BriefingActionResult {
  error?: string;
  report?: BriefingReport;
}

export async function triggerBriefing(): Promise<BriefingActionResult> {
  try {
    const report = await runBriefing();
    revalidatePath("/monitor");
    revalidatePath("/");
    return { report };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function addMonitorTopic(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const keywords = (formData.get("keywords") as string)?.trim() || null;
  const note = (formData.get("note") as string)?.trim() || null;
  if (!name) throw new Error("话题名不能为空");
  // 新话题排到最后
  const { data: last } = await db()
    .from("monitor_topics")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? 0) + 1;
  const { error } = await db().from("monitor_topics").insert({ name, keywords, note, position });
  if (error) throw new Error(`添加失败：${error.message}`);
  revalidatePath("/monitor");
}

export async function toggleMonitorTopic(id: string, enabled: boolean) {
  const { error } = await db().from("monitor_topics").update({ enabled }).eq("id", id);
  if (error) throw new Error(`更新失败：${error.message}`);
  revalidatePath("/monitor");
}

export async function deleteMonitorTopic(id: string) {
  const { error } = await db().from("monitor_topics").delete().eq("id", id);
  if (error) throw new Error(`删除失败：${error.message}`);
  revalidatePath("/monitor");
}

export async function deleteBriefing(id: string) {
  const { error } = await db().from("briefings").delete().eq("id", id);
  if (error) throw new Error(`删除失败：${error.message}`);
  revalidatePath("/monitor");
}

// ── 简报选题 → X 帖子（走内容 Agent：X 轨风格+范例 → Gate → draft_review 等人审）──

export interface XPostActionResult {
  error?: string;
  runId?: string;
  title?: string;
}

/** X 帖首个有效行 → run 标题（简版 extractTitle，不跨 "use server" 模块复用） */
function xpostTitle(draft: string): string {
  const line = draft
    .split("\n")
    .map((l) => l.replace(/\*\*/g, "").replace(/^[#\-*>【\s]+|】\s*$/g, "").trim())
    .find((l) => l.length > 0);
  return `【X帖】${(line ?? "（无标题）").slice(0, 50)}`;
}

export async function createXPostFromItem(briefingId: string, itemIndex: number): Promise<XPostActionResult> {
  // 条目在服务端重新解析（不信任客户端传内容），index 对不上说明简报被改过
  const { data: briefing, error } = await db()
    .from("briefings").select("title, body_md").eq("id", briefingId).single();
  if (error) return { error: `读取简报失败：${error.message}` };
  const item = parseBriefingItems(briefing.body_md)[itemIndex];
  if (!item) return { error: "条目解析失败——简报格式可能已变，刷新页面重试" };

  const material = itemToMaterial(item, briefing.title);
  const { data: created, error: insErr } = await db()
    .from("runs")
    .insert({ track: "x", material, status: "drafting", title: `【X帖】${item.topic}（生成中）` })
    .select("id")
    .single();
  if (insErr) return { error: `创建 run 失败：${insErr.message}` };
  const runId = created.id as string;

  try {
    const post = await agent.xpost(material);
    const gate = await agent.gate("x", post.text, material);
    const { error: updErr } = await db()
      .from("runs")
      .update({
        status: "draft_review",
        draft: post.text,
        checklist: gate.text,
        title: xpostTitle(post.text),
        models: { strong: post.call.model, gate: gate.call.model },
        token_usage: {
          input_tokens: post.call.input_tokens + gate.call.input_tokens,
          output_tokens: post.call.output_tokens + gate.call.output_tokens,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (updErr) throw new Error(`保存成稿失败：${updErr.message}`);
    for (const call of [post.call, gate.call]) {
      await db().from("llm_calls").insert({ ...call, run_id: runId });
    }
    revalidatePath("/agent/x");
    revalidatePath("/agent/x/runs");
    return { runId, title: xpostTitle(post.text) };
  } catch (e) {
    // 与产线 guard 同款：生成态异常必须置 failed，不能漏在 drafting
    const message = (e as Error).message;
    await db().from("runs")
      .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
      .eq("id", runId);
    return { error: message };
  }
}
