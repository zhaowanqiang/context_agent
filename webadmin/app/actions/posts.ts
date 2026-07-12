"use server";

import { revalidatePath } from "next/cache";
import { extractSummary, newSlug, postOfRun } from "@/lib/posts";
import { db } from "@/lib/supabase";
import type { Run } from "@/lib/types";
import type { ActionResult } from "./runs";

/** run 详情页「回流到个人站」：终稿（draft_final ?? draft）生成公开层 post */
export async function publishRunToSite(runId: string): Promise<ActionResult> {
  try {
    const { data, error } = await db().from("runs").select("*").eq("id", runId).single();
    if (error || !data) throw new Error(`读取 run 失败：${error?.message ?? "not found"}`);
    const run = data as Run;
    if (run.status !== "published") throw new Error("先在工作台标记发布，定稿后再回流个人站");
    const content = run.draft_final ?? run.draft;
    if (!content) throw new Error("该 run 没有成稿内容");
    if (await postOfRun(runId)) return { message: "已回流过，个人站上已有这篇" };

    const slug = newSlug();
    const { error: insErr } = await db().from("posts").insert({
      run_id: runId,
      track: run.track,
      slug,
      title: run.title ?? "（无标题）",
      summary: extractSummary(content, run.title),
      content_md: content,
    });
    if (insErr) throw new Error(`回流失败：${insErr.message}`);

    revalidatePath("/posts");
    revalidatePath(`/agent/${run.track}/runs/${runId}`);
    return { message: `已发布到个人站：/posts/${slug}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}

/** 从个人站下架（不动 run 与平台发布记录） */
export async function unpublishPost(postId: string): Promise<ActionResult> {
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
