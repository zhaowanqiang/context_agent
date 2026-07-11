import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 定时任务运行戳：本地文件记录每个 job 最后一次触发时间，
 * 服务启动时据此补跑「今天该跑但没跑」的任务（PC 关机/睡眠错过 cron 的兜底）。
 * 放 runs/ 下与产线记录同级，不占 Supabase。
 */
function stampDir(): string {
  const root = process.env.AGENT_PROJECT_ROOT ?? path.resolve(process.cwd(), "..");
  return path.join(root, "runs", "cron-stamps");
}

export async function readStamp(job: string): Promise<Date | null> {
  try {
    const raw = await readFile(path.join(stampDir(), `${job}.txt`), "utf-8");
    const d = new Date(raw.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** 触发即写戳（成功失败都算「今天试过了」，失败走告警而不是无限重跑） */
export async function writeStamp(job: string): Promise<void> {
  try {
    await mkdir(stampDir(), { recursive: true });
    await writeFile(path.join(stampDir(), `${job}.txt`), new Date().toISOString(), "utf-8");
  } catch (e) {
    console.error(`[cronStamp] 写运行戳失败（${job}）：`, e);
  }
}

/** 仅识别「分 时 * * *」的每日表达式 → 今天的应跑时刻；其他写法返回 null（不补跑） */
export function dailyScheduleToday(expr: string): Date | null {
  const m = expr.trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[2]), Number(m[1]), 0, 0);
  return d;
}

/** 今天的应跑时刻已过、且上次触发早于该时刻 → 错过了，需要补跑 */
export function missedToday(expr: string, last: Date | null): boolean {
  const sched = dailyScheduleToday(expr);
  if (!sched) return false;
  return Date.now() > sched.getTime() && (!last || last.getTime() < sched.getTime());
}
