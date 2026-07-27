"use server";

import { revalidatePath } from "next/cache";
import { extractSummary, newSlug, postOfRun } from "@/lib/posts";
import { db } from "@/lib/supabase";
import type { Run } from "@/lib/types";
import type { ActionResult } from "./runs";
import { requireAdmin } from "@/lib/adminAuth";

/** 发布自动上站的质检门槛：低于此分不自动回流，交给详情页手动按钮把关 */
const SITE_PUBLISH_MIN_QUALITY = Number(process.env.SITE_PUBLISH_MIN_QUALITY ?? 7);

/** run 详情页「回流到个人站」：终稿（draft_final ?? draft）生成公开层 post */
export async function publishRunToSite(runId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { data, error } = await db().from("runs").select("*").eq("id", runId).single();
    if (error || !data) throw new Error(`读取 run 失败：${error?.message ?? "not found"}`);
    const run = data as Run;
    if (run.status !== "published") throw new Error("先在工作台标记发布，定稿后再回流个人站");
    const content = run.draft_final ?? run.draft;
    if (!content) throw new Error("该 run 没有成稿内容");
    if (await postOfRun(runId)) return { message: "已回流过，个人站上已有这篇" };

    // 文章日期 = 平台首次发布时间（不是回流那一刻——批量回流会把日期挤成同一天，访客看着像死站）
    const { data: pub } = await db()
      .from("publications")
      .select("published_at")
      .eq("run_id", runId)
      .order("published_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const slug = newSlug();
    const { error: insErr } = await db().from("posts").insert({
      run_id: runId,
      track: run.track,
      slug,
      title: run.title ?? "（无标题）",
      summary: extractSummary(content, run.title),
      content_md: content,
      published_at: pub?.published_at ?? run.updated_at,
    });
    if (insErr) throw new Error(`回流失败：${insErr.message}`);

    revalidatePath("/posts");
    revalidatePath(`/agent/${run.track}/runs/${runId}`);
    return { message: `已发布到个人站：/posts/${slug}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}

/**
 * 发布自动回流个人站：markPublished 调用。避免「发布了但没上站 → /posts 好几天没更新」的死站观感。
 * 只自动回流公众号长文轨（X 短帖列表定位不同，走详情页手动按钮）；质检达标 + 未回流过才执行。
 * 永不抛错（回流失败不能挡发布），返回给用户看的一句话（null = 无需提示）。
 */
export async function autoPublishToSite(run: Run): Promise<string | null> {
  await requireAdmin();
  try {
    if (run.track !== "wechat") return null; // X 短帖不自动上站，避免混进长文列表
    if (await postOfRun(run.id)) return null;

    // 质检门槛：Gate 后质检分写在 checklist 头部；没有分数的（早期 run）放行
    const quality = run.checklist?.match(/【质量自检】([\d.]+)\/10/)?.[1];
    if (quality && Number(quality) < SITE_PUBLISH_MIN_QUALITY) {
      return `质检 ${quality} 分低于 ${SITE_PUBLISH_MIN_QUALITY} 分，未自动上站（详情页可手动回流 /posts）`;
    }

    const r = await publishRunToSite(run.id);
    return r.error ? `个人站回流失败：${r.error}` : (r.message ?? "已自动回流到个人站 /posts");
  } catch (e) {
    return `个人站回流失败：${(e as Error).message}`;
  }
}

/** 从个人站下架（不动 run 与平台发布记录） */
export async function unpublishPost(postId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { data, error } = await db()
      .from("posts")
      .delete()
      .eq("id", postId)
      .select("run_id, track, slug")
      .single();
    if (error) throw new Error(`下架失败：${error.message}`);
    revalidatePath("/posts");
    revalidatePath(`/posts/${data.slug}`);
    if (data.run_id && data.track) revalidatePath(`/agent/${data.track}/runs/${data.run_id}`);
    return { message: "已从个人站下架" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}
