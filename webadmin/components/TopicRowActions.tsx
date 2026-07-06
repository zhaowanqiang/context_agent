"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { discardTopic, shortlistTopic } from "@/app/actions/topics";
import type { FeedItemStatus } from "@/lib/types";

export default function TopicRowActions({ id, status }: { id: string; status: FeedItemStatus }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const cls = "rounded px-2 py-1 text-xs disabled:opacity-50";

  return (
    <span className="flex shrink-0 gap-1.5">
      {status === "shortlisted" ? (
        <button
          disabled={isPending}
          onClick={() => router.push(`/runs/new?feed_item=${id}`)}
          className={`${cls} bg-neutral-900 text-white hover:bg-neutral-700`}
        >
          开始创作
        </button>
      ) : (
        <button
          disabled={isPending || status === "used"}
          onClick={() => startTransition(async () => { await shortlistTopic(id); })}
          className={`${cls} border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100`}
        >
          入候选
        </button>
      )}
      {status !== "used" && (
        <button
          disabled={isPending}
          onClick={() => startTransition(async () => { await discardTopic(id); })}
          className={`${cls} border border-neutral-200 bg-white text-neutral-400 hover:text-red-600`}
        >
          丢弃
        </button>
      )}
    </span>
  );
}
