"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMonitorTopic, toggleMonitorTopic } from "@/app/actions/monitor";

export default function MonitorTopicRowActions({ id, enabled }: { id: string; enabled: boolean }) {
  // 与 SourceRowActions 同款：不用 useTransition/useOptimistic（Next 16 transition 竞态 #88767），
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
          setLocalEnabled(next);
          setIsPending(true);
          try {
            await toggleMonitorTopic(id, next);
            router.refresh();
          } catch {
            setLocalEnabled(null);
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
          if (!confirm("删除该监控话题？（不影响已收到的简报）")) return;
          setIsPending(true);
          try {
            await deleteMonitorTopic(id);
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
