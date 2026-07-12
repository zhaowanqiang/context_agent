"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import type { PublicationStats } from "@/lib/types";
import type { ActionResult } from "./runs";

/** 发布队列：设置/清除计划发布日期（null = 移出排期） */
export async function setPlannedDate(runId: string, date: string | null): Promise<ActionResult> {
  try {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日期格式应为 YYYY-MM-DD");
    const { error } = await db()
      .from("runs")
      .update({ planned_publish_on: date, updated_at: new Date().toISOString() })
      .eq("id", runId);
    if (error) throw new Error(`保存排期失败：${error.message}`);
    revalidatePath("/publish");
    return { message: date ? `已排期 ${date}` : "已移出排期" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}

/** 效果回填：发布 48h 后手动填各渠道数据（全部字段为空视为清除） */
export async function savePublicationStats(
  publicationId: string,
  stats: PublicationStats
): Promise<ActionResult> {
  try {
    const cleaned: PublicationStats = {};
    for (const [k, v] of Object.entries(stats)) {
      if (Number.isFinite(v) && v >= 0) cleaned[k] = v;
    }
    const empty = Object.keys(cleaned).length === 0;
    const { error } = await db()
      .from("publications")
      .update({
        stats: empty ? null : cleaned,
        stats_updated_at: empty ? null : new Date().toISOString(),
      })
      .eq("id", publicationId);
    if (error) throw new Error(`保存效果数据失败：${error.message}`);
    revalidatePath("/publish");
    return { message: empty ? "已清除" : "已保存" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}
