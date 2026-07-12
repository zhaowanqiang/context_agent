"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { triggerWeeklyReview } from "@/app/actions/monitor";

/** 手动跑一期周报（纯统计秒出，零 LLM 成本；cron 周日 20:00 自动跑） */
export default function WeeklyReviewButton() {
  const [isPending, setIsPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="text-right">
      <button
        onClick={async () => {
          setIsPending(true);
          setMsg(null);
          try {
            const r = await triggerWeeklyReview();
            router.refresh();
            setMsg(r.error ?? `已生成：${r.title}`);
          } finally {
            setIsPending(false);
          }
        }}
        disabled={isPending}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[12.5px] text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-50"
      >
        {isPending ? "统计中…" : "📋 生成周报"}
      </button>
      {msg && <p className="mt-1 text-[11.5px] text-neutral-400">{msg}</p>}
    </div>
  );
}
