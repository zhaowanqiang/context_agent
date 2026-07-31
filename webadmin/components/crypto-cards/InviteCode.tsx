"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";

/**
 * 邀请码 + 一键复制。
 * 复制成功后图标切对勾 2s，并通过 aria-live 播报——只靠图标变化，
 * 读屏用户不会知道发生了什么。
 */
export default function InviteCode({
  code,
  cardSlug,
  className = "",
}: {
  code: string;
  cardSlug: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 卸载时清掉计时器，避免在已移除的组件上 setState
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy(e: React.MouseEvent) {
    // 整卡可点开详情，复制不该顺带把详情打开
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return; // 无剪贴板权限（非安全上下文）时静默——不给假的成功反馈
    }
    track("referral_click", { target: cardSlug, meta: { from: "cards_invite_copy" } });
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 ${className}`}>
      {/* 只读输入框而不是 <code>：用户可以直接选中、也能用键盘全选复制 */}
      <input
        readOnly
        value={code}
        aria-label="邀请码"
        onClick={(e) => {
          e.stopPropagation();
          e.currentTarget.select();
        }}
        className="min-w-0 flex-1 truncate bg-transparent font-mono text-[12.5px] text-neutral-700 outline-none"
      />
      <button
        type="button"
        onClick={copy}
        aria-label={`复制邀请码 ${code}`}
        className="shrink-0 rounded p-1 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700"
      >
        {copied ? (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5V9A1.5 1.5 0 0 0 4 10.5h1" />
          </svg>
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "邀请码已复制" : ""}
      </span>
    </div>
  );
}
