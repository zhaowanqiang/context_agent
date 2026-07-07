"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchTopics, scoreNewTopics, type TopicActionResult } from "@/app/actions/topics";
import type { TrackId } from "@/lib/types";

export default function TopicToolbar({ track }: { track: TrackId }) {
  // 不用 useTransition：Next 16 的 React transition 竞态 bug（#88767）会让 isPending 卡死
  const [isPending, setIsPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  const act = async (fn: () => Promise<TopicActionResult>) => {
    setMsg(null);
    setIsPending(true);
    try {
      const r = await fn();
      setIsError(!!r.error);
      setMsg(r.error ?? r.message ?? null);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => act(() => fetchTopics(track))}
          disabled={isPending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isPending ? "处理中…" : "抓取全部源"}
        </button>
        <button
          onClick={() => act(() => scoreNewTopics(track))}
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
