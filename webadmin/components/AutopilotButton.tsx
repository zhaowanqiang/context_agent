"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { triggerAutopilot } from "@/app/actions/autopilot";
import type { TrackId } from "@/lib/types";

export default function AutopilotButton({ track }: { track: TrackId }) {
  // 不用 useTransition：Next 16 的 React transition 竞态 bug（#88767）会让 isPending 卡死
  const [isPending, setIsPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  const run = async () => {
    setMsg(null);
    setIsPending(true);
    try {
      const r = await triggerAutopilot(track);
      router.refresh(); // 刷新仪表盘统计/待审列表
      if (r.error) {
        setIsError(true);
        setMsg(r.error);
        return;
      }
      setIsError(false);
      const rep = r.report!;
      const ok = rep.created.filter((c) => c.ok);
      const failed = rep.created.filter((c) => !c.ok);
      let m = `抓取 ${rep.fetched}；${rep.scored}；产出 ${ok.length} 篇待审终稿`;
      if (ok.length > 0) m += `：${ok.map((c) => c.title).join("｜")}`;
      if (failed.length > 0) m += `；失败 ${failed.length} 篇（详见 Runs）`;
      if (rep.skipped.length > 0) m += `；跳过：${rep.skipped.join("，")}`;
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
        className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
      >
        {isPending ? "产线运行中…（每篇 3–5 分钟，别关页面）" : "🤖 跑一次全自动产线"}
      </button>
      {track === "x" && (
        <p className="text-xs text-neutral-400 sm:text-right">X 轨产线只放行 GitHub 库解读（其余选题需一手实测）</p>
      )}
      {msg && (
        <p className={`text-sm ${isError ? "text-red-700" : "text-neutral-600"}`}>{msg}</p>
      )}
    </div>
  );
}
