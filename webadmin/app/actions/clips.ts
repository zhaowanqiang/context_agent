"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { isTrackId } from "@/lib/types";
import type { ActionResult } from "./runs";

/** 剪藏入库（原生 form action，返回 void）：URL 或一段文字至少一个非空；无效输入静默忽略 */
export async function addClip(formData: FormData): Promise<void> {
  const rawUrl = String(formData.get("url") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const trackRaw = String(formData.get("track") ?? "");
  if (!rawUrl && !note) return;
  let url: string | null = null;
  if (rawUrl) {
    try {
      url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`).toString();
    } catch {
      return; // 链接格式不对：静默忽略（同 monitor 添加话题的原生表单风格）
    }
  }
  const { error } = await db().from("clips").insert({
    url,
    note: note || null,
    track: isTrackId(trackRaw) ? trackRaw : null,
  });
  if (error) console.error("[clips] 入库失败：", error.message);
  revalidatePath("/clips");
}

export async function discardClip(id: string): Promise<ActionResult> {
  try {
    const { error } = await db().from("clips").update({ status: "discarded" }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/clips");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}

export async function deleteClip(id: string): Promise<ActionResult> {
  try {
    const { error } = await db().from("clips").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/clips");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}
