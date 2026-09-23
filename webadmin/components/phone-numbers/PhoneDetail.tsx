"use client";

import { useEffect, useRef } from "react";
import type { FactValue } from "@/data/crypto-cards";
import { NUMBER_TYPE_LABEL, USAGES, type PhoneNumberEntry } from "@/data/phone-numbers";

/**
 * 海外手机号详情面板。
 *
 * 弹窗外壳单独实现（不改动 crypto-cards/CardDetail.tsx），交互与卡片详情一致：
 * 焦点陷阱、Esc 关闭、背景锁滚（补滚动条宽度）、关闭后焦点归位；
 * 桌面居中弹窗、移动端底部抽屉，动画复用 globals.css 的 .cc-overlay / .cc-sheet
 * （已被 prefers-reduced-motion 关掉）。
 */

const FACT_LABELS: Array<[keyof PhoneNumberEntry["facts"], string]> = [
  ["acquisition", "获取方式"],
  ["keepAlive", "保号规则"],
  ["minCost", "最低保号成本"],
  ["overseasSms", "海外平台验证码"],
];

/** 三态渲染规则与卡片模块一致：partial 带边界说明，pending 斜体「待核实」 */
function Fact({ label, value }: { label: string; value: FactValue }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-600">{label}</p>
      {value.status === "pending" ? (
        <p className="mt-1 text-[13.5px] font-medium italic text-neutral-600">待核实</p>
      ) : (
        <>
          <p className="mt-1 text-[13.5px] font-medium text-neutral-900">{value.value}</p>
          {value.note && <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-600">{value.note}</p>}
        </>
      )}
    </div>
  );
}

export default function PhoneDetail({ entry, onClose }: { entry: PhoneNumberEntry; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  /* 打开时记住焦点来处、锁背景滚动；关闭时全部还原 */
  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    const barWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (barWidth > 0) document.body.style.paddingRight = `${barWidth}px`;
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
      restoreTo.current?.focus?.();
    };
  }, []);

  /* Esc 关闭 + 焦点陷阱 */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const titleId = `pn-detail-title-${entry.slug}`;

  return (
    <div
      className="cc-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="cc-sheet flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:max-h-[88vh] sm:max-w-2xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start gap-4 border-b border-neutral-100 px-5 py-4 sm:px-6 sm:pt-6">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
              {entry.region} · {NUMBER_TYPE_LABEL[entry.numberType]}
            </p>
            <h2 id={titleId} className="mt-1 text-[19px] font-bold leading-snug text-neutral-900">
              {entry.carrier}
            </h2>
            <p className="mt-1 text-[12px] text-neutral-500">
              {entry.lastVerified ? `${entry.lastVerified} 核对` : "未核对"}
              {entry.status === "pending" && " · 内容整理中"}
              {entry.status === "deprecated" && " · 已停用"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {FACT_LABELS.map(([k, label]) => (
              <Fact key={k} label={label} value={entry.facts[k]} />
            ))}
          </div>

          <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">适合用途</h3>
          <dl className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {USAGES.map((u) => {
              const v = entry.usage[u.id] ?? { status: "pending" as const };
              return (
                <div key={u.id} className="flex items-baseline justify-between gap-4 px-3 py-2.5 text-[13px]">
                  <dt className="text-neutral-600">{u.label}</dt>
                  <dd className="text-right">
                    {v.status === "pending" ? (
                      <span className="italic text-neutral-600">待核实</span>
                    ) : (
                      <>
                        <span className="font-medium text-neutral-900">{v.value}</span>
                        {v.note && <span className="block text-[11.5px] text-neutral-600">{v.note}</span>}
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>

          <div className="mt-6">
            {entry.tutorialUrl ? (
              <a
                href={entry.tutorialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-amber-700 px-4 py-2 text-[13.5px] font-medium text-white transition hover:bg-amber-800"
              >
                看我在 X 上的教程 ↗
              </a>
            ) : (
              <p className="text-[13px] italic text-neutral-600">教程整理中。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
