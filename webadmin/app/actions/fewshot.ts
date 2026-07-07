"use server";

import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { AUTO_FILE, FEWSHOT_MAX, fewshotDir } from "@/lib/fewshotStore";
import { db } from "@/lib/supabase";
import type { Run, TrackId } from "@/lib/types";

export interface FewshotResult {
  error?: string;
  message?: string;
}

/** 自动入库的质检分门槛：低于此分不喂回，防机器味自我强化（手动按钮可无视门槛强制入库） */
const FEWSHOT_MIN_QUALITY = Number(process.env.FEWSHOT_MIN_QUALITY ?? 7);

interface WriteResult extends FewshotResult {
  filename?: string;
}

/** 核心写入：手动按钮与发布自动喂回共用 */
async function writeRunToFewshot(run: Run): Promise<WriteResult> {
  if (!["published", "draft_review"].includes(run.status)) {
    return { error: `当前状态 ${run.status} 没有可入库的终稿` };
  }
  const content = (run.draft_final ?? run.draft ?? "").trim();
  if (!content) return { error: "终稿为空" };

  const dir = fewshotDir(run.track);
  await mkdir(dir, { recursive: true });
  const existing = (await readdir(dir)).filter((f) => f.endsWith(".md"));

  // 防重复：同一 run 的短 id 出现在文件名里就不再入库
  const shortId = run.id.slice(0, 8);
  if (existing.some((f) => f.includes(shortId))) {
    return { error: "这篇已经在范例库里了" };
  }

  // 序号取现有最大值 +1（淘汰过旧文件后也不会撞号）
  const maxNN = existing.reduce((m, f) => Math.max(m, Number(f.slice(0, 2)) || 0), 0);
  const nn = String(maxNN + 1).padStart(2, "0");
  const slug = (run.title ?? "untitled")
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const filename = `${nn}-${shortId}-${slug}.md`;
  await writeFile(path.join(dir, filename), content, "utf-8");

  return {
    filename,
    message: `已存入范例库：${filename}（当前 ${existing.length + 1} 条，下次生成即生效）`,
  };
}

/** 手动按钮：把 run 的人工终稿存进该轨道的 few-shot 范例库（不做质检门槛，你点了就是要存） */
export async function saveToFewshot(runId: string): Promise<FewshotResult> {
  try {
    const { data, error } = await db().from("runs").select("*").eq("id", runId).single();
    if (error) throw new Error(error.message);
    const run = data as Run;
    const r = await writeRunToFewshot(run);
    if (r.error) return { error: r.error };
    let message = r.message!;
    const count = (await readdir(fewshotDir(run.track))).filter((f) => f.endsWith(".md")).length;
    if (count > FEWSHOT_MAX) {
      message += ` —— 已超过 ${FEWSHOT_MAX} 条，建议删掉表现最弱的一篇（范例太多会稀释风格、增加成本）`;
    }
    // 刷新成稿页按钮状态（→ ✓ 已在范例库）和范例库页
    revalidatePath(`/${run.track}/runs/${runId}`);
    revalidatePath(`/${run.track}/fewshot`);
    return { message };
  } catch (e) {
    return { error: `入库失败：${(e as Error).message}` };
  }
}

/**
 * 发布自动喂回：markPublished 调用。质检分不够/重复时静默跳过，超上限淘汰最旧的自动范例。
 * 永不抛错（喂库失败不能挡发布），返回给用户看的一句话（null = 无需提示）。
 */
export async function autoFeedFewshot(run: Run): Promise<string | null> {
  try {
    // 质检门槛：Gate 后质检分写在 checklist 头部；没有分数的（早期 run）放行
    const quality = run.checklist?.match(/【质量自检】([\d.]+)\/10/)?.[1];
    if (quality && Number(quality) < FEWSHOT_MIN_QUALITY) {
      return `质检 ${quality} 分低于 ${FEWSHOT_MIN_QUALITY} 分，未自动入范例库（成稿页按钮可强制存入）`;
    }

    const r = await writeRunToFewshot(run);
    if (r.error) {
      // 重复入库是正常情况（比如手动存过），静默
      return r.error.includes("已经在范例库里") ? null : `范例库自动入库失败：${r.error}`;
    }

    // 淘汰：只删最旧的自动范例，手工范例和刚写入的这篇永不动
    const dir = fewshotDir(run.track);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
    const candidates = files.filter((f) => AUTO_FILE.test(f) && f !== r.filename);
    const removed: string[] = [];
    while (files.length - removed.length > FEWSHOT_MAX && removed.length < candidates.length) {
      const victim = candidates[removed.length];
      await unlink(path.join(dir, victim));
      removed.push(victim);
    }

    let note = `终稿已自动喂入范例库（${files.length - removed.length} 条）`;
    if (removed.length > 0) note += `，淘汰最旧范例 ${removed.join("、")}`;
    return note;
  } catch (e) {
    return `范例库自动入库失败：${(e as Error).message}`;
  }
}

/** 范例库页面的删除按钮：淘汰表现弱的范例（文件名来自 listFewshot，不接受路径分隔符） */
export async function deleteFewshotFile(track: TrackId, filename: string): Promise<FewshotResult> {
  try {
    if (!/^[^\\/]+\.md$/.test(filename)) return { error: "文件名不合法" };
    await unlink(path.join(fewshotDir(track), filename));
    revalidatePath(`/${track}/fewshot`);
    return { message: `已删除 ${filename}，下次生成即生效` };
  } catch (e) {
    return { error: `删除失败：${(e as Error).message}` };
  }
}
