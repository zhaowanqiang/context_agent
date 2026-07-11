"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { triggerBriefing } from "@/app/actions/monitor";

export default function BriefingRunButton() {
  // 不用 useTransition：Next 16 的 React transition 竞态 bug（#88767）会让 isPending 卡死
  const [isPending, setIsPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  const run = async () => {
    setMsg(null);
    setIsPending(true);
    try {
      const r = await triggerBriefing();
      router.refresh();
      if (r.error) {
        setIsError(true);
        setMsg(r.error);
        return;
      }
      setIsError(false);
      const rep = r.report!;
      let m = `检索 ${rep.queries} 次 → 候选 ${rep.candidates} 条 → 简报 ${rep.itemCount} 条`;
      if (rep.searchErrors.length > 0) m += `；${rep.searchErrors.length} 次检索失败`;
      setMsg(m);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={run}
        disabled={isPending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 shadow-sm transition-colors hover:bg-neutral-700 disabled:opacity-50"
      >
        {isPending ? "检索整理中…（约 2–4 分钟，别关页面）" : "📡 立即生成简报"}
      </button>
      {msg && <p className={`text-sm ${isError ? "text-red-700" : "text-neutral-600"}`}>{msg}</p>}
    </div>
  );
}
