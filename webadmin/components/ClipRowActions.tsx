"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteClip, discardClip } from "@/app/actions/clips";
import type { ClipStatus, TrackId } from "@/lib/types";

/** 剪藏行操作：转素材（跳新建 Run 预填）/ 丢弃 / 删除 */
export default function ClipRowActions({
  id,
  status,
  track,
}: {
  id: string;
  status: ClipStatus;
  track: TrackId | null;
}) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const act = async (fn: () => Promise<{ error?: string }>) => {
    setIsPending(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const btn = "rounded-md border px-2 py-1 text-[12px] transition disabled:opacity-50";

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {status === "new" && (
        <>
          {(track ? [track] : (["wechat", "x"] as TrackId[])).map((t) => (
            <button
              key={t}
              disabled={isPending}
              onClick={() => router.push(`/agent/${t}/runs/new?clip=${id}`)}
              className={`${btn} border-amber-300 bg-amber-50 font-medium text-amber-700 hover:bg-amber-100`}
            >
              转素材{track ? "" : t === "wechat" ? "→公众号" : "→X"}
            </button>
          ))}
          <button
            disabled={isPending}
            onClick={() => act(() => discardClip(id))}
            className={`${btn} border-neutral-200 bg-white text-neutral-400 hover:text-neutral-600`}
          >
            丢弃
          </button>
        </>
      )}
      {status !== "new" && (
        <button
          disabled={isPending}
          onClick={() => {
            if (!confirm("删除这条剪藏？")) return;
            act(() => deleteClip(id));
          }}
          className={`${btn} border-neutral-200 bg-white text-neutral-400 hover:border-red-200 hover:text-red-600`}
        >
          删除
        </button>
      )}
    </span>
  );
}
