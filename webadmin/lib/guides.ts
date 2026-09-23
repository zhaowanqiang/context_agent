import "server-only";
import { cache } from "react";
import type { ReferralCategory } from "@/data/referrals";
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
  /** 品类：与 /deals 共用 REFERRAL_CATEGORIES，列表页据此筛选。null = 未归类 */
  category: ReferralCategory | null;
  /**
   * 文末主推的返佣产品 id（data/referrals.ts）。正文中段的内嵌卡走
   * ::referral{} 标记，两者互不干扰：标记管"读到这一步该开哪个"，
   * 这个字段管"整篇读完该开哪个"。
   */
  referral_ids: string[];
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

/**
 * 行 → Guide。referral_ids 在库里可能是 null（旧行、或建表增量还没跑到那一列），
 * 而调用方全都按数组用（.map / .length）。在这一层补齐，比让每个页面
 * 各写一次 `?? []` 可靠——漏一个就是一次生产 500。
 */
function toGuide(row: unknown): Guide {
  const r = row as Guide & { referral_ids: string[] | null };
  return { ...r, referral_ids: r.referral_ids ?? [] };
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
  return (data ?? []).map(toGuide);
}

/**
 * 已发布教程的 slug 集合：返佣卡的「看教程」只在目标真的上站时才出，
 * 否则指向 404（注册表里的 guideSlug 是预先写好的，教程未必已发布）。
 * 表未建 / 库不可达时返回空集——宁可少一个次要入口，不给死链。
 */
export async function publishedGuideSlugs(): Promise<Set<string>> {
  try {
    const { data, error } = await db().from("guides").select("slug").eq("status", "published");
    if (error) return new Set();
    return new Set((data ?? []).map((g: { slug: string }) => g.slug));
  } catch {
    return new Set();
  }
}

/** 工作台：含草稿的全部教程 */
export async function listAllGuides(limit = 200): Promise<Guide[]> {
  const { data, error } = await db()
    .from("guides")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`读取教程列表失败：${error.message}`);
  return (data ?? []).map(toGuide);
}

/** React cache：generateMetadata 和页面各调一次，只打一趟 DB */
export const getGuideBySlug = cache(async (slug: string): Promise<Guide | null> => {
  const { data, error } = await db().from("guides").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`读取教程失败：${error.message}`);
  return data ? toGuide(data) : null;
});

export async function getGuideById(id: string): Promise<Guide | null> {
  const { data, error } = await db().from("guides").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`读取教程失败：${error.message}`);
  return data ? toGuide(data) : null;
}

/** "2026-07-28" → "2026 年 7 月核对"（教程的新鲜度＝核对时间，不是发布时间） */
export function formatVerified(date: string): string {
  const [y, m] = date.split("-");
  return `${y} 年 ${Number(m)} 月核对`;
}
