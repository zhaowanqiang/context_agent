"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPlannedDate } from "@/app/actions/publish";

/** 发布队列行内的排期控件：改了就存，清空即移出排期 */
export default function PlannedDateInput({ runId, value }: { runId: string; value: string | null }) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const save = async (date: string) => {
    setIsPending(true);
    try {
      await setPlannedDate(runId, date || null);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <input
      type="date"
      defaultValue={value ?? ""}
      disabled={isPending}
      onChange={(e) => save(e.target.value)}
      className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] text-neutral-600 outline-none transition focus:border-amber-500 disabled:opacity-50"
    />
  );
}
