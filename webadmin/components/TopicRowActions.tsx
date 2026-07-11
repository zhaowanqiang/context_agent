"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { discardTopic, shortlistTopic } from "@/app/actions/topics";
import type { FeedItemStatus, TrackId } from "@/lib/types";

export default function TopicRowActions({
  id,
  status,
  track,
}: {
  id: string;
  status: FeedItemStatus;
  track: TrackId;
}) {
  // 不用 useTransition/useOptimistic：Next 16 捆绑的 React 19 有 transition 竞态 bug
  // （action resolve 太快时 replay 丢失，页面不更新、乐观状态回弹，vercel/next.js#88767）。
  // 改成本地覆盖状态：点击瞬间切 UI，服务端写完 router.refresh() 对齐真实数据。
  const [localStatus, setLocalStatus] = useState<FeedItemStatus | null>(null);
  const shown = localStatus ?? status;
  const router = useRouter();

  const mutate = async (next: FeedItemStatus, fn: () => Promise<{ error?: string }>) => {
    setLocalStatus(next);
    const r = await fn();
    if (r.error) setLocalStatus(null); // 失败回弹
    router.refresh();
  };

  const cls = "rounded px-2 py-1 text-xs disabled:opacity-50";

  return (
    <span className="flex shrink-0 gap-1.5">
      {shown === "shortlisted" ? (
        <button
          onClick={() => router.push(`/agent/${track}/runs/new?feed_item=${id}`)}
          className={`${cls} bg-neutral-900 text-white hover:bg-neutral-700`}
        >
          开始创作
        </button>
      ) : (
        <button
          disabled={shown === "used"}
          onClick={() => mutate("shortlisted", () => shortlistTopic(id, track))}
          className={`${cls} border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100`}
        >
          入候选
        </button>
      )}
      {shown !== "used" && shown !== "discarded" && (
        <button
          onClick={() => mutate("discarded", () => discardTopic(id, track))}
          className={`${cls} border border-neutral-200 bg-white text-neutral-400 hover:text-red-600`}
        >
          丢弃
        </button>
      )}
      {shown === "discarded" && status !== "discarded" && (
        <span className="px-2 py-1 text-xs text-neutral-400">已丢弃</span>
      )}
    </span>
  );
}
