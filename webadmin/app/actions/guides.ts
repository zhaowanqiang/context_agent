"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import {
  getReferral,
  isActive,
  REFERRAL_CATEGORIES,
  type ReferralCategory,
} from "@/data/referrals";
import { referencedReferralIds } from "@/lib/guideBlocks";
import { getGuideById, normalizeSlug, type Guide } from "@/lib/guides";
import { removeGuideImages, uploadGuideImage } from "@/lib/guideImages";
import { db } from "@/lib/supabase";
import { countUnfilledSlots, parseThread, toMarkdown } from "@/lib/xthread";
import type { ActionResult } from "./runs";

const CATEGORY_IDS = new Set<string>(REFERRAL_CATEGORIES.map((c) => c.id));

/** 表单来的品类：非法值一律当"未归类"，不写脏数据进库 */
function parseCategory(v: FormDataEntryValue | null): ReferralCategory | null {
  const s = String(v ?? "").trim();
  return CATEGORY_IDS.has(s) ? (s as ReferralCategory) : null;
}

/** 表单来的返佣 id 多选：只留注册表里真实存在的，顺带去重保序 */
function parseReferralIds(values: FormDataEntryValue[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const id = String(v).trim();
    if (id && getReferral(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** 摘要：正文首个非标题、非图片段落 */
function summarize(md: string, limit = 120): string {
  const line = md
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !/^[#>\-*|![]/.test(l) && !l.startsWith("---"));
  return (line ?? "").replace(/\*\*|`|\[([^\]]*)\]\([^)]*\)/g, "$1").slice(0, limit);
}

/**
 * 导入：粘贴的 X 线程原文 → 拆条成 markdown → 存成草稿。
 * 草稿不进公开层（listGuides 只取 published），所以这一步不需要把关。
 */
export async function importThread(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const raw = String(formData.get("raw") ?? "").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim();

  if (!title) return { error: "标题不能为空" };
  if (!raw) return { error: "把 X 上的线程原文粘进来" };
  const slug = normalizeSlug(rawSlug || title);
  if (!slug) {
    return { error: "slug 不能为空——中文标题没法自动转，手填一个英文的（如 kast-card）" };
  }

  const md = toMarkdown(parseThread(raw), { sourceUrl: sourceUrl || null });
  let id: string;
  try {
    const { data, error } = await db()
      .from("guides")
      .insert({
        slug,
        title,
        summary: summarize(md),
        content_md: md,
        source_url: sourceUrl || null,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) {
      // 唯一约束：同一篇重复导入是最常见的误操作，给条能看懂的提示
      if (error.code === "23505") return { error: `slug「${slug}」已经有一篇了，换一个` };
      throw new Error(error.message);
    }
    id = data.id as string;
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }

  revalidatePath("/import");
  redirect(`/import/${id}`);
}

/** 编辑页保存（正文、标题、摘要、核对日期、封面） */
export async function saveGuide(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const content_md = String(formData.get("content_md") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const summary = String(formData.get("summary") ?? "").trim();
    const verified = String(formData.get("verified_at") ?? "").trim();
    const cover = String(formData.get("cover_url") ?? "").trim();
    const category = parseCategory(formData.get("category"));
    const referral_ids = parseReferralIds(formData.getAll("referral_ids"));
    if (!title) return { error: "标题不能为空" };
    if (!content_md.trim()) return { error: "正文不能为空" };

    const { error } = await db()
      .from("guides")
      .update({
        title,
        content_md,
        summary: summary || summarize(content_md),
        verified_at: verified || null,
        cover_url: cover || null,
        category,
        referral_ids,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    const guide = await getGuideById(id);
    revalidatePath(`/import/${id}`);
    if (guide?.status === "published") {
      revalidatePath("/guides");
      revalidatePath(`/guides/${guide.slug}`);
    }
    return { message: "已保存" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}

/**
 * 配图上传：存进公开桶，返回 markdown 片段。
 * 带 slot 时直接替换正文里对应的 ![配图 N](IMG_N) 占位——
 * 位置是解析时从原文 【此处为插图】 记下来的，别让人再找一遍。
 */
export async function uploadImage(
  id: string,
  formData: FormData
): Promise<ActionResult & { url?: string; markdown?: string }> {
  await requireAdmin();
  try {
    const guide = await getGuideById(id);
    if (!guide) return { error: "教程不存在" };
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "没选到文件" };
    const alt = String(formData.get("alt") ?? "").trim();
    const slot = String(formData.get("slot") ?? "").trim();

    const { url } = await uploadGuideImage(guide.slug, file);
    const markdown = `![${alt || "配图"}](${url})`;

    if (slot) {
      // 占位替换：只换这一个，别把同名的都扫了
      const needle = `](IMG_${slot})`;
      const at = guide.content_md.indexOf(needle);
      if (at >= 0) {
        const start = guide.content_md.lastIndexOf("![", at);
        const next =
          guide.content_md.slice(0, start) + markdown + guide.content_md.slice(at + needle.length);
        const { error } = await db()
          .from("guides")
          .update({ content_md: next, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw new Error(error.message);
      }
    }

    revalidatePath(`/import/${id}`);
    return { message: slot ? `配图 ${slot} 已填入` : "已上传，把片段插到正文里", url, markdown };
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}

/**
 * 发布到公开层。三道闸门，都是"发出去才发现就晚了"的那类问题：
 * 1. 残留的配图占位 —— 页面上会渲染成裂图，比没有图更难看。
 * 2. 写错的返佣 id —— 渲染层是静默跳过的（对访客报错没意义），
 *    所以拼错一个字母的后果是那个位悄无声息地消失，只有这里能抓到。
 * 3. 引用了还没填链接的占位条目（如注册表里 url 为空的 RackNerd）——
 *    上站了也不会渲染，等于白挂一个位，不如现在就告诉你去填链接。
 */
export async function publishGuide(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const guide = await getGuideById(id);
    if (!guide) return { error: "教程不存在" };
    const unfilled = countUnfilledSlots(guide.content_md);
    if (unfilled > 0) {
      return { error: `还有 ${unfilled} 个配图位没填——上传图片，或把那几行 ![配图 N](IMG_N) 删掉` };
    }

    const referenced = [...new Set([...referencedReferralIds(guide.content_md), ...guide.referral_ids])];
    const unknown = referenced.filter((rid) => !getReferral(rid));
    if (unknown.length > 0) {
      return {
        error: `返佣 id 不存在：${unknown.join("、")}——检查拼写，或先去 data/referrals.ts 加这个产品`,
      };
    }
    const empty = referenced.filter((rid) => {
      const r = getReferral(rid);
      return r !== undefined && !isActive(r);
    });
    if (empty.length > 0) {
      return {
        error: `${empty.join("、")} 还没填返佣链接/邀请码，上站也不会渲染——去 data/referrals.ts 补上 url 再发`,
      };
    }

    const { error } = await db()
      .from("guides")
      .update({
        status: "published",
        published_at: guide.published_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/guides");
    revalidatePath(`/guides/${guide.slug}`);
    revalidatePath("/import");
    return { message: `已上站：/guides/${guide.slug}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}

export async function unpublishGuide(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { data, error } = await db()
      .from("guides")
      .update({ status: "draft" })
      .eq("id", id)
      .select("slug")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/guides");
    revalidatePath(`/guides/${(data as Pick<Guide, "slug">).slug}`);
    revalidatePath("/import");
    return { message: "已下架，回到草稿" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}

/** 删除教程连同它名下的配图（桶里不留孤儿文件） */
export async function deleteGuide(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const guide = await getGuideById(id);
    if (!guide) return { error: "教程不存在" };
    const { error } = await db().from("guides").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await removeGuideImages(guide.slug);
    revalidatePath("/guides");
    revalidatePath("/import");
    return { message: "已删除" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : `${e}` };
  }
}
