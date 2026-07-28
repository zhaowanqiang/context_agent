import "server-only";
import { db } from "@/lib/supabase";
import { GUIDE_BUCKET } from "@/lib/guides";

/** 截图基本都是 png/jpg；webp/gif 一并放行。不收 svg——公开桶里的 svg 能带脚本 */
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

export interface UploadedImage {
  url: string;
  path: string;
}

function extOf(type: string): string {
  return { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }[type] ?? "bin";
}

/**
 * 教程配图上传到公开桶，返回可直接写进 markdown 的 URL。
 *
 * 为什么必须转存而不是引 X 的图链：pbs.twimg.com 是 X 的 CDN，
 * 删推、改可见性或者哪天开防盗链，站上的图就整片变空——
 * 而教程正是「图没了就废了」的那类内容。
 */
export async function uploadGuideImage(slug: string, file: File): Promise<UploadedImage> {
  if (!ALLOWED.has(file.type)) {
    throw new Error(`不支持的图片格式：${file.type || "未知"}（只收 png / jpg / webp / gif）`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`图片 ${(file.size / 1024 / 1024).toFixed(1)}MB 超过 8MB 上限，先压一下`);
  }

  const path = `${slug}/${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${extOf(file.type)}`;
  const { error } = await db()
    .storage.from(GUIDE_BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) throw new Error(`上传失败：${error.message}`);

  const { data } = db().storage.from(GUIDE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** 教程删除时清掉它名下的图，不在桶里留孤儿 */
export async function removeGuideImages(slug: string): Promise<void> {
  const { data, error } = await db().storage.from(GUIDE_BUCKET).list(slug);
  if (error || !data || data.length === 0) return;
  await db().storage.from(GUIDE_BUCKET).remove(data.map((f) => `${slug}/${f.name}`));
}
