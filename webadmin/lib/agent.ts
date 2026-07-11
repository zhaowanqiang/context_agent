import "server-only";
import type { TrackId } from "./types";

const BASE = process.env.AGENT_API_URL ?? "http://127.0.0.1:8600";
// 必须大于 Python 端的 REQUEST_TIMEOUT（300s）
const TIMEOUT_MS = 320_000;

export interface LLMCallPayload {
  step: string;
  model: string;
  prompt: string;
  response: string;
  input_tokens: number;
  output_tokens: number;
}

export interface StepResult {
  text: string;
  call: LLMCallPayload;
}

export interface TopicScore {
  id: string;
  score: number;
  angle: string;
  reason: string;
}

export interface DraftReview {
  score: number;
  problems: string[];
  better_title: string | null;
}

export class AgentError extends Error {}

async function request<T>(path: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e: unknown) {
    const cause = (e as { cause?: { code?: string } }).cause;
    if (cause?.code === "ECONNREFUSED") {
      throw new AgentError("Python 服务未启动 —— 在项目根目录运行 start.ps1（或 python -m uvicorn contentagent.server:app --port 8600）");
    }
    if ((e as Error).name === "TimeoutError") {
      throw new AgentError(`LLM 调用超时（${timeoutMs / 1000}s）`);
    }
    throw new AgentError(`调用 Python 服务失败：${(e as Error).message}`);
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      const d = body.detail;
      message = typeof d === "string" ? d : d?.message ?? JSON.stringify(body);
    } catch { /* body 不是 JSON，保留状态码 */ }
    throw new AgentError(message);
  }
  return res.json() as Promise<T>;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const agent = {
  // 健康检查是本机请求，3s 足够；不能吃 LLM 的 320s 超时，否则服务卡住会拖死首页
  health: () =>
    request<{ status: string; provider: string; strong_model: string; gate_model: string; tracks: string[] }>("/health", undefined, 3_000),
  outline: (track: TrackId, material: string) =>
    post<StepResult>("/steps/outline", { track, material }),
  draft: (track: TrackId, outline: string) =>
    post<StepResult>("/steps/draft", { track, outline }),
  gate: (track: TrackId, draft: string, material: string) =>
    post<StepResult>("/steps/gate", { track, draft, material }),
  review: (track: TrackId, draft: string) =>
    post<{ review: DraftReview; call: LLMCallPayload }>("/steps/review", { track, draft }),
  scoreTopics: (track: TrackId, items: { id: string; title: string; summary: string }[], recentTitles: string[] = []) =>
    post<{ scores: TopicScore[]; call: LLMCallPayload }>("/topics/score", { track, items, recent_titles: recentTitles }),
  briefing: (
    date: string,
    topics: { name: string; keywords: string; note: string }[],
    candidates: { topic: string; title: string; link: string; source: string; published: string; summary: string }[]
  ) => post<StepResult>("/steps/briefing", { date, topics, candidates }),
  xpost: (item: string) => post<StepResult>("/steps/xpost", { item }),
};
