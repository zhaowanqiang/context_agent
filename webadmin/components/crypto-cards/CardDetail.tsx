"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CryptoCard } from "@/data/crypto-cards";
import { track } from "@/lib/track";
import CardArt from "./CardArt";
import InviteCode from "./InviteCode";

/**
 * 详情面板：桌面居中 Modal，移动端从底部升起的 sheet（可下拉关闭）。
 * 无 framer-motion（仓库没这个依赖，也不为一个模块引入），
 * 走 spec 给的降级路径：220ms fade + scale（keyframes 在 globals.css）。
 */

const KYC_LABEL: Record<string, string> = {
  none: "免 KYC",
  light: "轻度",
  full: "完整（证件 + 地址证明）",
};

const UNKNOWN = "待核实";

/** 事实字段的统一渲染：没来源就明说，不猜 */
function factText(v: string | string[] | boolean | null, whenTrue = "支持", whenFalse = "不支持"): string {
  if (v === null || v === undefined) return UNKNOWN;
  if (typeof v === "boolean") return v ? whenTrue : whenFalse;
  if (Array.isArray(v)) return v.length ? v.join(" / ") : UNKNOWN;
  return v;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  const unknown = value === UNKNOWN;
  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-600">{label}</p>
      <p className={`mt-1 text-[13.5px] font-semibold ${unknown ? "italic text-neutral-600" : "text-neutral-900"}`}>
        {value}
      </p>
      {note && <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-600">{note}</p>}
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((it) => (
          <li key={it} className={`text-[13px] leading-relaxed ${tone}`}>
            · {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

type Tab = "decision" | "tutorial" | "faq";

export default function CardDetail({ card, onClose }: { card: CryptoCard; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("decision"); // spec：默认停在开户决策
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  /* 打开时记住焦点来处，关闭后归位；同时锁住背景滚动 */
  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
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
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      // 焦点跑到面板外（含 body）就拽回来——这是「陷阱」的关键
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  /* 移动端下拉关闭：拖动过程中直接改 style，不进 React 状态 */
  useEffect(() => {
    const el = sheetRef.current;
    const handle = el?.querySelector<HTMLElement>("[data-sheet-handle]");
    if (!el || !handle) return;
    let startY = 0;
    let dy = 0;
    let dragging = false;

    const down = (e: PointerEvent) => {
      dragging = true;
      startY = e.clientY;
      dy = 0;
      el.style.transition = "none";
      handle.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - startY);
      el.style.transform = `translateY(${dy}px)`;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      el.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
      if (dy > 100) onClose();
      else el.style.transform = "";
    };

    handle.addEventListener("pointerdown", down);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
    return () => {
      handle.removeEventListener("pointerdown", down);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };
  }, [onClose]);

  const f = card.facts;
  const notes = f.notes ?? {};
  const href = card.invite?.url;
  const titleId = `cc-detail-title-${card.slug}`;

  const TABS: { id: Tab; label: string }[] = [
    { id: "decision", label: "开户决策" },
    { id: "tutorial", label: "申请教程" },
    { id: "faq", label: "常见问题" },
  ];

  return (
    <div
      className="cc-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={(n) => {
          dialogRef.current = n;
          sheetRef.current = n;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="cc-sheet sm:cc-modal flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:max-h-[88vh] sm:max-w-3xl sm:rounded-2xl"
      >
        {/* 移动端下拉把手（桌面隐藏） */}
        <div data-sheet-handle className="flex shrink-0 cursor-grab touch-none justify-center py-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>

        {/* Hero */}
        <div className="flex shrink-0 items-start gap-4 border-b border-neutral-100 px-5 pb-4 sm:px-6 sm:pt-6">
          <div className="w-24 shrink-0 sm:w-32">
            <CardArt card={card} compact />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="text-lg font-bold tracking-tight text-neutral-900">
                {card.name}
              </h2>
              {card.status !== "live" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  {card.status === "waitlist" ? "等待名单" : card.status === "invite-only" ? "仅限邀请" : "已停用"}
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{card.decision.verdict}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track("referral_click", { target: card.slug, meta: { from: "cards_detail" } })}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-neutral-700"
                >
                  立即领取 ↗
                </a>
              ) : (
                card.signupNote && (
                  <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-[12px] leading-relaxed text-neutral-600">
                    {card.signupNote}
                  </p>
                )
              )}
              {card.invite && <InviteCode code={card.invite.code} cardSlug={card.slug} className="max-w-[190px]" />}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 rounded-md px-2 text-xl leading-none text-neutral-600 transition hover:text-neutral-900"
          >
            ×
          </button>
        </div>

        {/* 可滚动内容区 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {/* 关键指标 6 宫格 */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Metric label="返现" value={factText(f.cashback)} note={notes.cashback} />
            <Metric label="年费" value={factText(f.annualFee)} />
            <Metric label="KYC" value={f.kyc ? KYC_LABEL[f.kyc] : UNKNOWN} />
            <Metric label="地区" value={factText(f.regions)} note={notes.regions} />
            <Metric
              label="充值方式"
              value={factText(f.stablecoins ?? f.chains)}
            />
            <Metric
              label="托管方式"
              value={f.custody ? (f.custody === "custodial" ? "平台托管" : "自托管") : UNKNOWN}
            />
          </div>

          {/* Tabs */}
          <div role="tablist" aria-label="卡片详情" className="mt-6 flex gap-1 border-b border-neutral-200">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium transition ${
                  tab === t.id
                    ? "border-amber-600 text-neutral-900"
                    : "border-transparent text-neutral-600 hover:text-neutral-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="pt-4">
            {tab === "decision" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <List title="适合谁" items={card.decision.bestFor} tone="text-neutral-700" />
                  <List title="不适合谁" items={card.decision.notFor} tone="text-neutral-700" />
                  <List title="优点" items={card.decision.pros} tone="text-neutral-700" />
                  <List title="缺点" items={card.decision.cons} tone="text-neutral-700" />
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">风险</p>
                  <ul className="mt-1.5 space-y-1">
                    {card.decision.risks.map((r) => (
                      <li key={r} className="text-[13px] leading-relaxed text-amber-900">
                        · {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-[11.5px] text-neutral-600">最后核对：{card.decision.updatedAt}</p>
              </div>
            )}

            {tab === "tutorial" && (
              <div className="space-y-5">
                {card.tutorial.prerequisites.length > 0 && (
                  <List title="开始前准备" items={card.tutorial.prerequisites} tone="text-neutral-700" />
                )}

                {/* 带序号的时间轴：左侧圆点 + 连线 */}
                <ol className="relative space-y-5 border-l border-neutral-200 pl-6">
                  {card.tutorial.steps.map((s, i) => (
                    <li key={s.title} className="relative">
                      <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-[11px] font-bold text-neutral-500">
                        {i + 1}
                      </span>
                      <p className="text-[13.5px] font-semibold text-neutral-900">{s.title}</p>
                      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-neutral-600">{s.body}</p>
                      {/* tip 用 emerald 而非 spec 里的蓝色：全站是 Stone 暖灰 + amber，
                          没有任何冷色；emerald 在 decider 里已经在用，语义区分照旧成立 */}
                      {s.tip && (
                        <p className="mt-2 border-l-2 border-emerald-400 bg-emerald-50/60 px-3 py-2 text-[12.5px] leading-relaxed text-emerald-900">
                          {s.tip}
                        </p>
                      )}
                      {s.warning && (
                        <p className="mt-2 border-l-2 border-amber-400 bg-amber-50/70 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900">
                          {s.warning}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>

                {/* 完整教程入口。付费正文不在本模块的数据里，点过去由 /decider 的付费墙判定 */}
                {card.tutorial.guide && (
                  <Link
                    href={card.tutorial.guide.href}
                    className="block rounded-xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-amber-300 hover:bg-amber-50/40"
                  >
                    <p className="text-[13.5px] font-semibold text-neutral-900">
                      {card.tutorial.guide.free ? "阅读完整教程（全文免费）→" : "解锁完整实操 + 避坑清单 →"}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-600">
                      {card.tutorial.guide.free
                        ? "站内教程页有全部步骤，无付费墙。"
                        : "上面是免费部分；逐步实操与避坑清单在教程页，含最后核对时间。"}
                    </p>
                  </Link>
                )}
              </div>
            )}

            {tab === "faq" && (
              <div className="space-y-3">
                {card.tutorial.faq?.length ? (
                  card.tutorial.faq.map((q) => (
                    <details key={q.q} className="rounded-xl border border-neutral-200 p-3">
                      <summary className="cursor-pointer text-[13.5px] font-medium text-neutral-900">{q.q}</summary>
                      <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{q.a}</p>
                    </details>
                  ))
                ) : (
                  <p className="text-[13px] text-neutral-600">
                    这张卡还没整理常见问题。教程页里有更完整的实操说明。
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 免责声明：固定在内容底部 */}
          <p className="mt-8 border-t border-neutral-100 pt-4 text-[11.5px] leading-relaxed text-neutral-600">
            以上为个人实测记录与判断，<b className="font-medium text-neutral-800">不构成投资或理财建议</b>。
            页面内的邀请码与开户链接为返佣链接，你通过它注册我可能获得推荐奖励，
            但不影响你的费用，也不影响上面写的优缺点。
            跨境开户政策、费率与地区可用性随时会变，请以官方页面为准；标注「{UNKNOWN}」的字段表示我尚未实测核实，不做猜测。
          </p>
        </div>
      </div>
    </div>
  );
}
