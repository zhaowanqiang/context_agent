"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agent, AgentError, LLMCallPayload } from "@/lib/agent";
import { db } from "@/lib/supabase";
import type { Run, RunStatus, TrackId } from "@/lib/types";

export interface ActionResult {
  error?: string;
}

/** 大纲首个有效行 → 列表页标题（跳过「大纲」「标题：」类前缀行，去掉 markdown 记号） */
function extractTitle(outline: string): string {
  const line = outline
    .split("\n")
    .map((l) =>
      l
        .replace(/^[#\-*>【\s]+|】\s*$/g, "")
        .replace(/^(标题|题目)\s*[:：]\s*/, "")
        .trim()
    )
    .find((l) => l.length > 0 && !/^(大纲|标题|题目|outline)$/i.test(l));
  return (line ?? "（无标题）").slice(0, 60);
}

async function getRun(runId: string): Promise<Run> {
  const { data, error } = await db().from("runs").select("*").eq("id", runId).single();
  if (error) throw new Error(`读取 run 失败：${error.message}`);
  return data as Run;
}

async function updateRun(runId: string, patch: Record<string, unknown>) {
  const { error } = await db()
    .from("runs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw new Error(`更新 run 失败：${error.message}`);
}

async function saveCall(runId: string | null, call: LLMCallPayload) {
  const { error } = await db().from("llm_calls").insert({
    run_id: runId,
    step: call.step,
    model: call.model,
    prompt: call.prompt,
    response: call.response,
    input_tokens: call.input_tokens,
    output_tokens: call.output_tokens,
  });
  if (error) throw new Error(`记录 llm_call 失败：${error.message}`);
}

async function addTokenUsage(runId: string, ...calls: LLMCallPayload[]) {
  const run = await getRun(runId);
  const prev = run.token_usage ?? { input_tokens: 0, output_tokens: 0 };
  await updateRun(runId, {
    token_usage: {
      input_tokens: prev.input_tokens + calls.reduce((s, c) => s + c.input_tokens, 0),
      output_tokens: prev.output_tokens + calls.reduce((s, c) => s + c.output_tokens, 0),
    },
  });
}

/** 统一收口：异常 → { error }，LLM 失败时把 run 置 failed */
async function guard(runId: string | null, fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return {};
  } catch (e) {
    const message = e instanceof AgentError || e instanceof Error ? e.message : `${e}`;
    if (runId && e instanceof AgentError) {
      try {
        await updateRun(runId, { status: "failed" satisfies RunStatus, error: message });
        revalidatePath(`/runs/${runId}`);
      } catch { /* 置 failed 本身失败时，保留原始错误 */ }
    }
    return { error: message };
  }
}

// ── 新建（useActionState form action，校验失败返回错误，成功跳转）───

const ARTICLE_MARKER = "【原文全文】";
const ARTICLE_FAIL_PLACEHOLDER = "（自动抓取失败——打开上面的原文链接，把正文复制粘贴到这里）";

export async function createRun(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const track = formData.get("track") as TrackId;
  const material = (formData.get("material") as string)?.trim();
  const feedItemId = (formData.get("feed_item_id") as string) || null;
  if (!material) return { error: "素材不能为空" };

  // 公众号轨道是二次创作：底料（原文全文）必须够厚，否则模型只能空转编造
  if (track === "wechat") {
    if (material.includes(ARTICLE_MARKER)) {
      const article = material
        .split(ARTICLE_MARKER)[1]
        ?.split("【我的补充观点】")[0]
        ?.replace(ARTICLE_FAIL_PLACEHOLDER, "")
        .trim();
      if (!article || article.length < 200) {
        return {
          error:
            "【原文全文】还没填。二次创作的底料就是原文——自动抓取失败的话，打开原文链接把正文复制粘贴进来（至少 200 字）。",
        };
      }
    } else if (material.length < 200) {
      return { error: "素材太薄（不足 200 字）。二次创作需要足够的原文/信息底料，粘贴原文正文再创建。" };
    }
  }

  const { data, error } = await db()
    .from("runs")
    .insert({ track, material, feed_item_id: feedItemId, status: "created" })
    .select("id")
    .single();
  if (error) throw new Error(`创建 run 失败：${error.message}`);

  if (feedItemId) {
    await db().from("feed_items").update({ status: "used" }).eq("id", feedItemId);
  }
  redirect(`/runs/${data.id}`);
}

// ── Hop 1：生成大纲 ──────────────────────────────────────────────────

export async function generateOutline(runId: string): Promise<ActionResult> {
  return guard(runId, async () => {
    const run = await getRun(runId);
    if (!["created", "failed"].includes(run.status)) {
      throw new Error(`当前状态 ${run.status} 不能生成大纲`);
    }
    await updateRun(runId, { status: "outlining", error: null });
    revalidatePath(`/runs/${runId}`);

    const result = await agent.outline(run.track, run.material);
    await saveCall(runId, result.call);
    await updateRun(runId, {
      status: "outline_review",
      outline_generated: result.text,
      title: extractTitle(result.text),
    });
    await addTokenUsage(runId, result.call);
    revalidatePath(`/runs/${runId}`);
    revalidatePath("/runs");
  });
}

// ── 人工闸口确认 → Hop 2 + Gate（串行，单次动作最长 ~5 分钟）─────────

export async function confirmOutline(runId: string, outlineFinal: string): Promise<ActionResult> {
  return guard(runId, async () => {
    const run = await getRun(runId);
    if (run.status !== "outline_review") throw new Error(`当前状态 ${run.status} 不能确认大纲`);
    if (!outlineFinal.trim()) throw new Error("大纲不能为空");

    const edited = outlineFinal.trim() !== (run.outline_generated ?? "").trim();
    await updateRun(runId, {
      status: "drafting",
      outline_final: outlineFinal,
      outline_edited: edited,
      error: null,
    });
    revalidatePath(`/runs/${runId}`);

    const draftRes = await agent.draft(run.track, outlineFinal);
    await saveCall(runId, draftRes.call);
    await updateRun(runId, { status: "gating", draft: draftRes.text, draft_final: draftRes.text });
    revalidatePath(`/runs/${runId}`);

    const gateRes = await agent.gate(run.track, draftRes.text, run.material);
    await saveCall(runId, gateRes.call);
    await updateRun(runId, { status: "draft_review", checklist: gateRes.text });
    await addTokenUsage(runId, draftRes.call, gateRes.call);
    revalidatePath(`/runs/${runId}`);
    revalidatePath("/runs");
  });
}

// ── 一键直通：大纲不经人工确认，直接跑到成稿（全自动模式）───────────

export async function autoRunToDraft(runId: string): Promise<ActionResult> {
  const r1 = await generateOutline(runId);
  if (r1.error) return r1;
  const run = await getRun(runId);
  // 大纲原样确认（outline_edited=false），draft_review 仍是发布前的人工检查点
  return confirmOutline(runId, run.outline_generated ?? "");
}

// ── 重跑成稿（draft_review 下不满意时，从当前 outline_final 重来）────

export async function regenerateDraft(runId: string): Promise<ActionResult> {
  return guard(runId, async () => {
    const run = await getRun(runId);
    if (run.status !== "draft_review") throw new Error(`当前状态 ${run.status} 不能重跑成稿`);
    await updateRun(runId, { status: "outline_review" });
    const r = await confirmOutline(runId, run.outline_final ?? run.outline_generated ?? "");
    if (r.error) throw new Error(r.error);
  });
}

// ── 润色保存 / 放弃 / 发布 / 卡死重置 ────────────────────────────────

export async function saveDraftFinal(runId: string, draftFinal: string): Promise<ActionResult> {
  return guard(null, async () => {
    const run = await getRun(runId);
    if (run.status !== "draft_review") throw new Error(`当前状态 ${run.status} 不能保存润色稿`);
    await updateRun(runId, { draft_final: draftFinal });
    revalidatePath(`/runs/${runId}`);
  });
}

export async function abortRun(runId: string): Promise<ActionResult> {
  return guard(null, async () => {
    await updateRun(runId, { status: "aborted" });
    revalidatePath(`/runs/${runId}`);
    revalidatePath("/runs");
  });
}

export async function markPublished(
  runId: string,
  channel: string,
  html: string | null
): Promise<ActionResult> {
  return guard(null, async () => {
    const run = await getRun(runId);
    if (run.status !== "draft_review") throw new Error(`当前状态 ${run.status} 不能标记发布`);
    const { error } = await db().from("publications").insert({
      run_id: runId,
      channel,
      title: run.title,
      html,
    });
    if (error) throw new Error(`记录发布失败：${error.message}`);
    await updateRun(runId, { status: "published" });
    revalidatePath(`/runs/${runId}`);
    revalidatePath("/runs");
  });
}

/** 状态卡在 *ing 超过 10 分钟视为中途崩溃，退回上一个可编辑状态 */
export async function resetStuckRun(runId: string): Promise<ActionResult> {
  return guard(null, async () => {
    const run = await getRun(runId);
    const stuckFor = Date.now() - new Date(run.updated_at).getTime();
    const editable: Partial<Record<RunStatus, RunStatus>> = {
      outlining: "created",
      drafting: "outline_review",
      gating: "outline_review",
    };
    const target = editable[run.status];
    if (!target) throw new Error(`当前状态 ${run.status} 无需重置`);
    if (stuckFor < 10 * 60 * 1000) throw new Error("生成可能仍在进行，10 分钟后再重置");
    await updateRun(runId, { status: target, error: "上次生成中断，已重置" });
    revalidatePath(`/runs/${runId}`);
  });
}
