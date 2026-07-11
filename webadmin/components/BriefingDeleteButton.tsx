"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteBriefing } from "@/app/actions/monitor";

export default function BriefingDeleteButton({ id, redirectTo }: { id: string; redirectTo?: string }) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  return (
    <button
      disabled={isPending}
      onClick={async () => {
        if (!confirm("删除这期简报？")) return;
        setIsPending(true);
        try {
          await deleteBriefing(id);
          if (redirectTo) router.push(redirectTo);
          else router.refresh();
        } finally {
          setIsPending(false);
        }
      }}
      className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-600 disabled:opacity-50"
    >
      删除
    </button>
  );
}
