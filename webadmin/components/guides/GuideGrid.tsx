"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { REFERRAL_CATEGORIES, type ReferralCategory } from "@/data/referrals";

/** 列表页只需要这几个字段。**不要把整个 Guide 传下来**——
 *  content_md 动辄几 KB，全塞进客户端 payload 是白白的传输成本。 */
export interface GuideCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  verifiedLabel: string | null;
  category: ReferralCategory | null;
}

/**
 * 教程网格 + 品类筛选。
 *
 * 筛选做在客户端而不是 ?category= 查询参数：页面开着 revalidate=60 的 ISR，
 * 一读 searchParams 就退化成逐请求渲染，为一个几十条的列表丢掉整页缓存不划算。
 * 客户端筛选还顺带没有跳转闪烁。
 */
export default function GuideGrid({ guides }: { guides: GuideCard[] }) {
  const [active, setActive] = useState<ReferralCategory | "all">("all");

  // 只显示真有内容的品类——空标签点进去是空页，不如不给
  const available = useMemo(() => {
    const present = new Set(guides.map((g) => g.category).filter(Boolean));
    return REFERRAL_CATEGORIES.filter((c) => present.has(c.id));
  }, [guides]);

  const shown = active === "all" ? guides : guides.filter((g) => g.category === active);

  return (
    <>
      {available.length > 1 && (
        <div className="mt-7 flex flex-wrap gap-2">
          <Chip label="全部" count={guides.length} on={active === "all"} onClick={() => setActive("all")} />
          {available.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              count={guides.filter((g) => g.category === c.id).length}
              on={active === c.id}
              onClick={() => setActive(c.id)}
            />
          ))}
        </div>
      )}

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((g) => (
          <li key={g.id} className="flex">
            <Link
              href={`/guides/${g.slug}`}
              className="group flex flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-amber-300 hover:shadow-[0_1px_16px_rgba(180,83,9,0.07)]"
            >
              {g.coverUrl && (
                // 封面走 <img>：图片托在 Supabase 公开桶，域名随项目变，
                // 用 next/image 还要在 next.config 里维护 remotePatterns 白名单
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={g.coverUrl}
                  alt=""
                  className="h-36 w-full border-b border-neutral-200 object-cover"
                />
              )}
              <div className="flex flex-1 flex-col p-5">
                <h2 className="text-[16px] font-semibold leading-snug text-neutral-900 transition group-hover:text-amber-700">
                  {g.title}
                </h2>
                {g.summary && (
                  <p className="mt-2 line-clamp-3 flex-1 text-[13px] leading-relaxed text-neutral-500">
                    {g.summary}
                  </p>
                )}
                <p className="mt-4 flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="font-medium text-amber-700">
                    看教程 <span className="inline-block transition group-hover:translate-x-0.5">→</span>
                  </span>
                  {g.verifiedLabel && <span className="text-neutral-400">{g.verifiedLabel}</span>}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {shown.length === 0 && (
        <p className="mt-16 text-center text-[13.5px] text-neutral-400">这个品类下还没有教程。</p>
      )}
    </>
  );
}

function Chip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1 text-[12.5px] transition ${
        on
          ? "border-amber-300 bg-amber-50 font-medium text-amber-800"
          : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
      }`}
    >
      {label} <span className="font-mono text-[11px] opacity-60">{count}</span>
    </button>
  );
}
