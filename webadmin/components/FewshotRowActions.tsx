"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteFewshotFile } from "@/app/actions/fewshot";
import type { TrackId } from "@/lib/types";

export default function FewshotRowActions({ track, filename }: { track: TrackId; filename: string }) {
  // 不用 useTransition：Next 16 捆绑的 React 19 有竞态 bug——action 在 transition 里
  // resolve 太快时 replay 丢失，isPending 永远卡住、页面不更新（vercel/next.js#88767）
  const [isPending, setIsPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  return (
    <span className="flex shrink-0 items-center gap-2">
      {err && <span className="text-xs text-red-600">{err}</span>}
      <button
        disabled={isPending}
        onClick={async () => {
          if (!confirm(`把「${filename}」移出范例库？删除后下次生成不再参考这篇。`)) return;
          setIsPending(true);
          try {
            const r = await deleteFewshotFile(track, filename);
            if (r.error) setErr(r.error);
            router.refresh();
          } finally {
            setIsPending(false);
          }
        }}
        className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "删除中…" : "删除"}
      </button>
    </span>
  );
}
