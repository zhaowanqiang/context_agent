"use client";

import { useTransition } from "react";
import { deleteSource, toggleSource } from "@/app/actions/sources";

export default function SourceRowActions({ id, enabled }: { id: string; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();
  const cls = "rounded px-2 py-1 text-xs border disabled:opacity-50";
  return (
    <span className="flex shrink-0 gap-1.5">
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => { await toggleSource(id, !enabled); })}
        className={`${cls} ${enabled ? "border-neutral-300 bg-white text-neutral-600" : "border-green-300 bg-green-50 text-green-700"}`}
      >
        {enabled ? "停用" : "启用"}
      </button>
      <button
        disabled={isPending}
        onClick={() => {
          if (confirm("删除该源及其抓取的所有条目？")) {
            startTransition(async () => { await deleteSource(id); });
          }
        }}
        className={`${cls} border-red-200 bg-white text-red-600`}
      >
        删除
      </button>
    </span>
  );
}
