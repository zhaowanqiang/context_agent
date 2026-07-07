"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSource, toggleSource } from "@/app/actions/sources";
import type { TrackId } from "@/lib/types";

export default function SourceRowActions({
  id,
  enabled,
  track,
}: {
  id: string;
  enabled: boolean;
  track: TrackId;
}) {
  // 不用 useTransition/useOptimistic：Next 16 的 React transition 竞态 bug（#88767），
  // 本地覆盖状态 + 完成后 router.refresh() 对齐。
  const [isPending, setIsPending] = useState(false);
  const [localEnabled, setLocalEnabled] = useState<boolean | null>(null);
  const shown = localEnabled ?? enabled;
  const router = useRouter();

  const cls = "rounded px-2 py-1 text-xs border disabled:opacity-50";
  return (
    <span className="flex shrink-0 gap-1.5">
      <button
        disabled={isPending}
        onClick={async () => {
          const next = !shown;
          setLocalEnabled(next); // 点击瞬间先翻状态
          setIsPending(true);
          try {
            await toggleSource(id, next, track);
            router.refresh();
          } catch {
            setLocalEnabled(null); // 失败回弹
          } finally {
            setIsPending(false);
          }
        }}
        className={`${cls} ${shown ? "border-neutral-300 bg-white text-neutral-600" : "border-green-300 bg-green-50 text-green-700"}`}
      >
        {shown ? "停用" : "启用"}
      </button>
      <button
        disabled={isPending}
        onClick={async () => {
          if (!confirm("删除该源及其抓取的所有条目？")) return;
          setIsPending(true);
          try {
            await deleteSource(id, track);
            router.refresh();
          } finally {
            setIsPending(false);
          }
        }}
        className={`${cls} border-red-200 bg-white text-red-600`}
      >
        删除
      </button>
    </span>
  );
}
