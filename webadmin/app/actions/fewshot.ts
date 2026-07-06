"use server";

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/supabase";
import type { Run } from "@/lib/types";

export interface FewshotResult {
  error?: string;
  message?: string;
}

/** tracks/<track>/fewshot/ 目录（webadmin 的上一级是项目根） */
function fewshotDir(track: string): string {
  const root = process.env.AGENT_PROJECT_ROOT ?? path.resolve(process.cwd(), "..");
  return path.join(root, "tracks", track, "fewshot");
}

/** 把 run 的人工终稿（draft_final）存进该轨道的 few-shot 范例库 */
export async function saveToFewshot(runId: string): Promise<FewshotResult> {
  try {
    const { data, error } = await db().from("runs").select("*").eq("id", runId).single();
    if (error) throw new Error(error.message);
    const run = data as Run;

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

    // 文件名：NN-短id-标题片段.md（按序号排序加载）
    const nn = String(existing.length + 1).padStart(2, "0");
    const slug = (run.title ?? "untitled")
      .replace(/[\\/:*?"<>|\s]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);
    const filename = `${nn}-${shortId}-${slug}.md`;
    await writeFile(path.join(dir, filename), content, "utf-8");

    const count = existing.length + 1;
    let message = `已存入范例库：${filename}（当前 ${count} 条，下次生成即生效）`;
    if (count > 8) {
      message += " —— 已超过 8 条，建议删掉表现最弱的一篇（范例太多会稀释风格、增加成本）";
    }
    return { message };
  } catch (e) {
    return { error: `入库失败：${(e as Error).message}` };
  }
}
