"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/track";
import type { Referral } from "@/data/referrals";

/**
 * 返佣位卡片：教程正文内嵌 / 文末 / /deals 汇总页共用一个组件。
 *
 * 三件事必须一起做，少一件这个位就白建了：
 * 1. rel="sponsored nofollow noopener" —— 返佣链接不声明就是 Google 眼里的
 *    付费链接作弊，整站排名会被拖累。教程吃的就是长尾搜索，赌不起。
 * 2. track("referral_click") —— 带 from 区分位置（正文内嵌 / 文末 / 汇总页），
 *    这样面板上能看出到底哪个位置在转化，而不是只有一个总数。
 * 3. 链接和邀请码至少有一个 —— 都没有就根本不该渲染（activeReferrals 已挡住），
 *    这里再兜一层，免得哪天有人绕过过滤直接传了个空条目进来。
 */
export default function ReferralCard({
  referral: r,
  from,
  variant = "block",
}: {
  referral: Referral;
  /** 埋点里的位置标识：guide_inline / guide_footer / deals */
  from: string;
  variant?: "inline" | "block";
}) {
  const hasLink = r.url !== "";
  if (!hasLink && !r.code) return null; // 没有任何可执行动作，不渲染死按钮

  const inline = variant === "inline";

  return (
    <div
      className={`not-prose my-6 rounded-xl border border-amber-200/80 bg-amber-50/50 ${
        inline ? "px-4 py-3.5" : "px-5 py-4.5"
      }`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className={inline ? "text-[18px] leading-none" : "text-[22px] leading-none"}>
          {r.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`font-semibold text-neutral-900 ${
              inline ? "text-[14px]" : "text-[15px]"
            }`}
          >
            {r.name}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-600">{r.pitch}</p>
          {r.perk && (
            <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-amber-800">
              ✦ {r.perk}
            </p>
          )}
          {r.note && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">{r.note}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasLink && (
              <a
                href={r.url}
                target="_blank"
                // sponsored：这是返佣链接，向搜索引擎如实声明
                rel="sponsored nofollow noopener"
                onClick={() => track("referral_click", { target: r.id, meta: { from } })}
                className="rounded-lg bg-amber-700 px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-amber-800"
              >
                用我的链接开通 →
              </a>
            )}
            {r.code && <CopyCode code={r.code} referralId={r.id} from={from} />}
            {r.guideSlug && !inline && (
              <Link
                href={`/guides/${r.guideSlug}`}
                className="text-[12.5px] text-neutral-500 underline-offset-2 transition hover:text-amber-700 hover:underline"
              >
                看教程
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 邀请码 + 一键复制。复制也算一次返佣点击——很多产品只能手填码，不记就等于漏了这批转化。 */
function CopyCode({ code, referralId, from }: { code: string; referralId: string; from: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return; // 无剪贴板权限（非安全上下文）：静默，不给假的成功反馈
    }
    track("referral_click", { target: referralId, meta: { from: `${from}_code` } });
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={`复制邀请码 ${code}`}
        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-mono text-[12.5px] text-amber-800 transition hover:bg-amber-100"
      >
        {copied ? "已复制 ✓" : `邀请码 ${code}`}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "邀请码已复制" : ""}
      </span>
    </>
  );
}
