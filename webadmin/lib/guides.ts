import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase";

/** 公开层教程：X 线程转存而来的常青内容，与 posts（时效存档）分表。 */
export interface Guide {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content_md: string;
  source_url: string | null;
  cover_url: string | null;
  verified_at: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 教程配图的公开存储桶（schema.sql 增量 2026-07-28 建） */
export const GUIDE_BUCKET = "guide-images";

/**
 * 教程 slug 走人工可读 ASCII——教程吃的是长尾搜索（"KAST 开卡"），
 * URL 里有词比随机短 ID 强。中文原样保留会被编码成一长串 %E4%B8%AD，
 * 所以非 ASCII 一律剔除，剩下空的就让调用方自己填。
 */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** 公开层：已发布的教程，新的在前 */
export async function listGuides(limit = 100): Promise<Guide[]> {
  const { data, error } = await db()
    .from("guides")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`读取教程列表失败：${error.message}`);
  return (data ?? []) as Guide[];
}

/** 工作台：含草稿的全部教程 */
export async function listAllGuides(limit = 200): Promise<Guide[]> {
  const { data, error } = await db()
    .from("guides")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`读取教程列表失败：${error.message}`);
  return (data ?? []) as Guide[];
}

/** React cache：generateMetadata 和页面各调一次，只打一趟 DB */
export const getGuideBySlug = cache(async (slug: string): Promise<Guide | null> => {
  const { data, error } = await db().from("guides").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`读取教程失败：${error.message}`);
  return (data as Guide) ?? null;
});

export async function getGuideById(id: string): Promise<Guide | null> {
  const { data, error } = await db().from("guides").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`读取教程失败：${error.message}`);
  return (data as Guide) ?? null;
}

/** "2026-07-28" → "2026 年 7 月核对"（教程的新鲜度＝核对时间，不是发布时间） */
export function formatVerified(date: string): string {
  const [y, m] = date.split("-");
  return `${y} 年 ${Number(m)} 月核对`;
}
