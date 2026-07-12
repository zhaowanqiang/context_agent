"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePublicationStats } from "@/app/actions/publish";
import type { PublicationStats } from "@/lib/types";

/** 效果回填行内表单：按渠道字段渲染数字输入，保存写 publications.stats */
export default function StatsFillForm({
  publicationId,
  fields,
  current,
}: {
  publicationId: string;
  fields: { key: string; label: string }[];
  current: PublicationStats | null;
}) {
  const [isPending, setIsPending] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, current?.[f.key]?.toString() ?? ""]))
  );
  const router = useRouter();

  const save = async () => {
    setIsPending(true);
    try {
      const stats: PublicationStats = {};
      for (const f of fields) {
        const n = Number(values[f.key]);
        if (values[f.key] !== "" && Number.isFinite(n)) stats[f.key] = n;
      }
      await savePublicationStats(publicationId, stats);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <span className="flex flex-wrap items-center gap-2">
      {fields.map((f) => (
        <label key={f.key} className="flex items-center gap-1 text-[12px] text-neutral-500">
          {f.label}
          <input
            type="number"
            min={0}
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="w-20 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] tabular-nums outline-none transition focus:border-amber-500"
          />
        </label>
      ))}
      <button
        onClick={save}
        disabled={isPending}
        className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
      >
        {isPending ? "…" : "保存"}
      </button>
    </span>
  );
}
