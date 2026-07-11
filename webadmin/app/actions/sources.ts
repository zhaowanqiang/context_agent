"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { isTrackId } from "@/lib/types";
import type { TrackId } from "@/lib/types";

export async function addSource(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const feedUrl = (formData.get("feed_url") as string)?.trim();
  const track = formData.get("track") as string;
  if (!name || !feedUrl) throw new Error("名称和 URL 不能为空");
  if (!isTrackId(track)) throw new Error("轨道不合法");
  const { error } = await db().from("sources").insert({ name, feed_url: feedUrl, track });
  if (error) throw new Error(`添加失败：${error.message}`);
  revalidatePath(`/agent/${track}/sources`);
}

export async function toggleSource(id: string, enabled: boolean, track: TrackId) {
  const { error } = await db().from("sources").update({ enabled }).eq("id", id);
  if (error) throw new Error(`更新失败：${error.message}`);
  revalidatePath(`/agent/${track}/sources`);
}

export async function deleteSource(id: string, track: TrackId) {
  const { error } = await db().from("sources").delete().eq("id", id);
  if (error) throw new Error(`删除失败：${error.message}`);
  revalidatePath(`/agent/${track}/sources`);
}
