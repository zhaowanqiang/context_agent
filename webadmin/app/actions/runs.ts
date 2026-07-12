"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agent, AgentError, LLMCallPayload } from "@/lib/agent";
import { lintDraft } from "@/lib/draftLint";
import { db } from "@/lib/supabase";
import type { Run, RunStatus, TrackId } from "@/lib/types";

export interface ActionResult {
  error?: string;
  /** 操作成功时给用户看的一句话（比调用方写死的提示优先） */
  message?: string;
  /** 成稿质检分（confirmOutline 流程回传，自动产线据此决定是否重写） */
  quality?: number;
  qualityProblems?: string[];
}

/** 质检分低于该值时，自动产线带着问题清单重写一次（人工流程只展示不重写） */
const QUALITY_MIN = Number(process.env.QUALITY_MIN ?? 7);

/** 大纲首个有效行 → 列表页标题（跳过「大纲」「标题：」类前缀行，去掉 markdown 记号） */
function extractTitle(outline: string): string {
  const line = outline
    .split("\n")
    .map((l) =>
      l
        .replace(/\*\*/g, "") // 去 markdown 加粗，避免「**标题**：」漏匹配
        .replace(/^[#\-*>【\s]+|】\s*$/g, "")
        .replace(/^(标题|题目|大纲)\s*[:：]\s*/, "")
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

/** run 详情/列表页都在轨道前缀下 */
function runPath(track: TrackId, runId?: string): string {
  return runId ? `/agent/${track}/runs/${runId}` : `/agent/${track}/runs`;
}

/** 统一收口：异常 → { error }，生成中途失败把 run 置 failed。
 *  不只 AgentError：Supabase 写失败等任何异常发生在 *ing 状态下都不能把 run 漏在生成态
 *  （否则永远卡「大纲生成中」）；校验类错误发生在稳定状态，不会误伤。 */
async function guard(runId: string | null, fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? {};
  } catch (e) {
    const message = e instanceof AgentError || e instanceof Error ? e.message : `${e}`;
    if (runId) {
      try {
        const run = await getRun(runId);
        if (["outlining", "drafting", "gating"].includes(run.status)) {
          await updateRun(runId, { status: "failed" satisfies RunStatus, error: message });
          revalidatePath(runPath(run.track, runId));
        }
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
  // 剪藏种子：标记已用并回链 run（失败不挡创建——clips 表可能还没建）
  const clipId = (formData.get("clip_id") as string) || null;
  if (clipId) {
    await db().from("clips").update({ status: "used", used_run_id: data.id }).eq("id", clipId);
  }
  redirect(runPath(track, data.id));
}

// ── Hop 1：生成大纲 ──────────────────────────────────────────────────

export async function generateOutline(runId: string): Promise<ActionResult> {
  return guard(runId, async () => {
    const run = await getRun(runId);
    if (!["created", "failed"].includes(run.status)) {
      throw new Error(`当前状态 ${run.status} 不能生成大纲`);
    }
    await updateRun(runId, { status: "outlining", error: null });
    revalidatePath(runPath(run.track, runId));

    const result = await agent.outline(run.track, run.material);
    await saveCall(runId, result.call);
    await updateRun(runId, {
      status: "outline_review",
      outline_generated: result.text,
      title: extractTitle(result.text),
    });
    await addTokenUsage(runId, result.call);
    revalidatePath(runPath(run.track, runId));
    revalidatePath(runPath(run.track));
  });
}

// ── 人工闸口确认 → Hop 2 + Gate（串行，单次动作最长 ~5 分钟）─────────

export async function confirmOutline(
  runId: string,
  outlineFinal: string,
  markEdited = true // 自动重写传 false：机器追加反馈不算人工改稿信号
): Promise<ActionResult> {
  return guard(runId, async () => {
    const run = await getRun(runId);
    if (run.status !== "outline_review") throw new Error(`当前状态 ${run.status} 不能确认大纲`);
    if (!outlineFinal.trim()) throw new Error("大纲不能为空");

    const edited = markEdited && outlineFinal.trim() !== (run.outline_generated ?? "").trim();
    await updateRun(runId, {
      status: "drafting",
      outline_final: outlineFinal,
      outline_edited: edited,
      error: null,
    });
    revalidatePath(runPath(run.track, runId));

    const draftRes = await agent.draft(run.track, outlineFinal);
    await saveCall(runId, draftRes.call);
    await updateRun(runId, { status: "gating", draft: draftRes.text, draft_final: draftRes.text });
    revalidatePath(runPath(run.track, runId));

    // Gate 与质检互不依赖（都只读成稿），并行跑：flash 单调用几十秒，串行白等一倍时长。
    // 质检失败不阻塞——Gate 是硬闸，质检只是增强
    const [gateRes, reviewOut] = await Promise.all([
      agent.gate(run.track, draftRes.text, run.material),
      agent.review(run.track, draftRes.text).catch(() => null),
    ]);
    await saveCall(runId, gateRes.call);

    let quality: number | undefined;
    let qualityProblems: string[] = [];
    let checklist = gateRes.text;
    const usageCalls = [draftRes.call, gateRes.call];
    if (reviewOut) {
      const { review, call } = reviewOut;
      await saveCall(runId, call);
      usageCalls.push(call);
      quality = review.score;
      qualityProblems = review.problems;
      const block = [
        `【质量自检】${review.score.toFixed(1)}/10${review.score < QUALITY_MIN ? `（低于发布线 ${QUALITY_MIN}）` : ""}`,
        ...(review.problems.length > 0 ? review.problems.map((p) => `- ${p}`) : ["- 无明显问题"]),
        ...(review.better_title ? [`建议标题：${review.better_title}`] : []),
      ].join("\n");
      checklist = `${block}\n\n---\n\n${gateRes.text}`;
    }

    // 机器校验（正则，零成本）置顶：残留标记/编造图链/字数超纲/绝对化用语，全过则不加块
    const lintIssues = lintDraft(run.track, draftRes.text, run.material, outlineFinal);
    if (lintIssues.length > 0) {
      const lintBlock = [
        `【机器校验】${lintIssues.length} 处需人工处理`,
        ...lintIssues.map((i) => `- ${i}`),
      ].join("\n");
      checklist = `${lintBlock}\n\n---\n\n${checklist}`;
    }

    await updateRun(runId, { status: "draft_review", checklist });
    await addTokenUsage(runId, ...usageCalls);
    revalidatePath(runPath(run.track, runId));
    revalidatePath(runPath(run.track));
    return { quality, qualityProblems };
  });
}

// ── 一键直通：大纲不经人工确认，直接跑到成稿（全自动模式）───────────

export async function autoRunToDraft(runId: string): Promise<ActionResult> {
  const r1 = await generateOutline(runId);
  if (r1.error) return r1;
  const run = await getRun(runId);
  // 大纲原样确认（outline_edited=false），draft_review 仍是发布前的人工检查点
  const r2 = await confirmOutline(runId, run.outline_generated ?? "");
  if (r2.error || r2.quality === undefined || r2.quality >= QUALITY_MIN) return r2;

  // 质检不及格：带着问题清单重写一次（只重写一次，防成本失控）
  const problems = (r2.qualityProblems ?? []).map((p) => `- ${p}`).join("\n");
  const outlineWithFeedback = [
    run.outline_generated ?? "",
    ``,
    `（上一稿质量自检 ${r2.quality.toFixed(1)} 分，低于发布线 ${QUALITY_MIN}。本稿必须修正以下问题，其余保持：`,
    problems || "- 整体质量不足，提高观点密度与结构清晰度",
    `）`,
  ].join("\n");
  await updateRun(runId, { status: "outline_review" });
  const r3 = await confirmOutline(runId, outlineWithFeedback, false);
  // 重写后仍低分也停下来交给人（draft_review），不无限循环
  return r3;
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
    revalidatePath(runPath(run.track, runId));
  });
}

export async function abortRun(runId: string): Promise<ActionResult> {
  return guard(null, async () => {
    const run = await getRun(runId);
    await updateRun(runId, { status: "aborted" });
    revalidatePath(runPath(run.track, runId));
    revalidatePath(runPath(run.track));
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

    // 发布 = 终稿定版 → 自动喂回 few-shot 范例库（质检分不够/重复时内部自行跳过，失败不挡发布）
    const { autoFeedFewshot } = await import("./fewshot");
    const feedNote = await autoFeedFewshot({ ...run, status: "published" });

    revalidatePath(runPath(run.track, runId));
    revalidatePath(runPath(run.track));
    revalidatePath(`/agent/${run.track}/fewshot`);
    return { message: `已标记发布${feedNote ? ` —— ${feedNote}` : ""}` };
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
    revalidatePath(runPath(run.track, runId));
  });
}
