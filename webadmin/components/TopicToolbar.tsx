"use client";

import { useState, useTransition } from "react";
import { fetchTopics, scoreNewTopics, type TopicActionResult } from "@/app/actions/topics";

export default function TopicToolbar() {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const act = (fn: () => Promise<TopicActionResult>) => {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setIsError(!!r.error);
      setMsg(r.error ?? r.message ?? null);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => act(fetchTopics)}
          disabled={isPending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isPending ? "处理中…" : "抓取全部源"}
        </button>
        <button
          onClick={() => act(scoreNewTopics)}
          disabled={isPending}
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          AI 打分（新条目）
        </button>
      </div>
      {msg && (
        <p className={`text-sm ${isError ? "text-red-700" : "text-green-700"}`}>{msg}</p>
      )}
    </div>
  );
}
