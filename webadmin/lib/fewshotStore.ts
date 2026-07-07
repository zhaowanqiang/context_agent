import "server-only";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/** 范例库软上限：超过时自动喂回会淘汰最旧的自动范例（与 actions/fewshot.ts 共用） */
export const FEWSHOT_MAX = Number(process.env.FEWSHOT_MAX ?? 8);

/** 自动入库的文件名形如 NN-8位runid-标题.md；手工范例（如 01-ai-ide-jiedu.md）不匹配该模式 */
export const AUTO_FILE = /^\d{2}-([0-9a-f]{8})-/;

/** tracks/<track>/fewshot/ 目录（webadmin 的上一级是项目根） */
export function fewshotDir(track: string): string {
  const root = process.env.AGENT_PROJECT_ROOT ?? path.resolve(process.cwd(), "..");
  return path.join(root, "tracks", track, "fewshot");
}

export interface FewshotEntry {
  filename: string;
  title: string;       // 正文首个非空行（去 markdown 记号）
  chars: number;
  auto: boolean;       // true=从 run 自动/手动入库；false=手工放置的原始范例
  runId8: string | null; // 自动入库时文件名里的 run 短 id
  savedAt: string;     // 文件 mtime（ISO）
  preview: string;     // 开头片段
}

/** 列出该轨道范例库全部条目（按文件名序号排序——与 Python loader 注入 prompt 的顺序一致） */
export async function listFewshot(track: string): Promise<FewshotEntry[]> {
  const dir = fewshotDir(track);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return []; // 目录不存在 = 空库
  }
  const entries: FewshotEntry[] = [];
  for (const f of files) {
    try {
      const full = path.join(dir, f);
      const [content, st] = await Promise.all([readFile(full, "utf-8"), stat(full)]);
      const text = content.trim();
      const title =
        text
          .split("\n")
          .map((l) => l.replace(/^[#>\-*\s]+/, "").trim())
          .find((l) => l.length > 0) ?? f;
      const m = f.match(AUTO_FILE);
      entries.push({
        filename: f,
        title: title.slice(0, 80),
        chars: text.length,
        auto: !!m,
        runId8: m ? m[1] : null,
        savedAt: st.mtime.toISOString(),
        preview: text.slice(0, 300),
      });
    } catch { /* 单个文件读失败不影响其余条目 */ }
  }
  return entries;
}

/** 该 run 的终稿是否已在范例库（文件名含 run 短 id） */
export async function runInFewshot(track: string, runId: string): Promise<string | null> {
  const shortId = runId.slice(0, 8);
  try {
    const files = await readdir(fewshotDir(track));
    return files.find((f) => f.endsWith(".md") && f.includes(shortId)) ?? null;
  } catch {
    return null;
  }
}
