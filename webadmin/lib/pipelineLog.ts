import "server-only";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AutopilotReport } from "./autopilot";

/** 产线运行记录：本地 JSON 文件（runs/autopilot/），不占 Supabase 表 */
function logDir(): string {
  const root = process.env.AGENT_PROJECT_ROOT ?? path.resolve(process.cwd(), "..");
  return path.join(root, "runs", "autopilot");
}

export async function saveReport(report: AutopilotReport): Promise<void> {
  try {
    const dir = logDir();
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    await writeFile(
      path.join(dir, `${stamp}-${report.track}.json`),
      JSON.stringify(report, null, 1),
      "utf-8"
    );
  } catch (e) {
    console.error("[pipelineLog] 写产线记录失败：", e);
  }
}

/** 该轨道最近一次产线记录（文件名按时间戳排序，取最新） */
export async function latestReport(track: string): Promise<AutopilotReport | null> {
  try {
    const files = (await readdir(logDir()))
      .filter((f) => f.endsWith(`-${track}.json`))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    return JSON.parse(await readFile(path.join(logDir(), files[0]), "utf-8")) as AutopilotReport;
  } catch {
    return null;
  }
}
