"use client";

import { useState } from "react";
import Link from "next/link";
import { createXPostFromItem } from "@/app/actions/monitor";
import type { BriefingItem } from "@/lib/briefingItems";

/** 简报条目 → 一键生成 X 帖（走内容 Agent X 轨：风格+范例+Gate，落 draft_review 等人审）。
 *  紧凑竖排卡片，适配右侧栏；窄屏时整栏落到正文下方。 */
export default function BriefingXPostPanel({
  briefingId,
  items,
}: {
  briefingId: string;
  items: BriefingItem[];
}) {
  // 不用 useTransition：Next 16 的 React transition 竞态 bug（#88767）
  const [pending, setPending] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, { runId: string; title: string }>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  if (items.length === 0) return null;
  const worthy = items.filter((it) => it.mark === "可做选题").length;

  const run = async (i: number) => {
    setErrors((e) => ({ ...e, [i]: "" }));
    setPending(i);
    try {
      const r = await createXPostFromItem(briefingId, i);
      if (r.error) setErrors((e) => ({ ...e, [i]: r.error! }));
      else setDone((d) => ({ ...d, [i]: { runId: r.runId!, title: r.title! } }));
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        ⚡ 选题转 X 帖
      </h3>
      <p className="mt-1 text-[11px] text-neutral-400">
        {worthy} 条可做选题 · 按我的风格生成，落到 X 轨等你审（1–2 分钟/条）
      </p>
      <ul className="mt-3 divide-y divide-neutral-100">
        {items.map((it, i) => (
          <li key={i} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
                  it.mark === "可做选题"
                    ? "bg-green-50 text-green-700"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {it.mark || "未标注"}
              </span>
              <span className="truncate text-xs font-semibold text-neutral-700">{it.topic}</span>
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">{it.summary}</p>
            {errors[i] && <p className="text-xs text-red-600">{errors[i]}</p>}
            {done[i] ? (
              <Link
                href={`/agent/x/runs/${done[i].runId}`}
                className="inline-block rounded border border-green-300 bg-green-50 px-2.5 py-1 text-xs text-green-700 hover:bg-green-100"
              >
                ✓ 查看草稿 →
              </Link>
            ) : (
              <button
                onClick={() => run(i)}
                disabled={pending !== null}
                className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:border-neutral-500 disabled:opacity-50"
              >
                {pending === i ? "生成中…（1–2 分钟）" : "✍️ 生成 X 帖"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
