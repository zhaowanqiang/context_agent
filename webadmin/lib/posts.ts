import "server-only";
import { randomBytes } from "node:crypto";
import { cache } from "react";
import { db } from "@/lib/supabase";
import type { TrackId } from "@/lib/types";

/** 个人网站公开层的文章：产线成稿回流（run → post）或手写。 */
export interface Post {
  id: string;
  run_id: string | null;
  track: TrackId | null;
  slug: string;
  title: string;
  summary: string | null;
  content_md: string;
  published_at: string;
  updated_at: string;
}

/** 中文标题不做拼音转写，slug 用 8 位随机短 ID（URL 稳定、不泄露发文节奏） */
export function newSlug(): string {
  return randomBytes(4).toString("hex");
}

/** 正文首个非标题段落 → 摘要（列表页/RSS/OG description）。
 *  部分成稿第一行是纯文本标题（没带 # 记号），传 title 跳过它——摘要重复标题很难看 */
export function extractSummary(md: string, title?: string | null, limit = 120): string {
  // 归一化含空白：成稿首行常是「标题加了空格排版」的变体（阿里内部禁用Claude vs 阿里内部禁用 Claude）
  const clean = (s: string) => s.replace(/\*\*|`|[「」“”\s]|\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
  const titleKey = title ? clean(title).slice(0, 30) : null;
  const para = md
    .split("\n")
    .map((l) => l.trim())
    .find((l) => {
      if (l.length === 0 || /^[#>\-*|!\[]/.test(l)) return false;
      if (titleKey && clean(l).startsWith(titleKey)) return false; // 首行=标题的裸文本，跳过
      return true;
    });
  const plain = (para ?? "").replace(/\*\*|`|\[([^\]]*)\]\([^)]*\)/g, "$1");
  return plain.slice(0, limit);
}

export async function listPosts(limit = 50): Promise<Post[]> {
  const { data, error } = await db()
    .from("posts")
    .select("id, run_id, track, slug, title, summary, published_at, updated_at, content_md")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`读取文章列表失败：${error.message}`);
  return (data ?? []) as Post[];
}

/** React cache：同一请求里 generateMetadata 和页面各调一次，只打一趟 DB */
export const getPostBySlug = cache(async (slug: string): Promise<Post | null> => {
  const { data, error } = await db().from("posts").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`读取文章失败：${error.message}`);
  return (data as Post) ?? null;
});

/** run 是否已回流为文章（run 详情页按钮据此显示状态） */
export async function postOfRun(runId: string): Promise<Post | null> {
  const { data, error } = await db().from("posts").select("*").eq("run_id", runId).maybeSingle();
  if (error) throw new Error(`查询回流状态失败：${error.message}`);
  return (data as Post) ?? null;
}
