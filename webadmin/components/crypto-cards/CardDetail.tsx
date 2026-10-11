"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import type { CryptoCard, FactValue } from "@/data/crypto-cards";
import type { CardTutorialLink } from "@/lib/tutorialTypes";
import { track } from "@/lib/track";
import CardFace from "./CardFace";
import InviteCode from "./InviteCode";

/**
 * 卡片详情面板：桌面居中 Modal，移动端从底部升起的 sheet（可下拉关闭）。
 *
 * 全站 43 张卡共用这一个组件，没有第二套实现——
 * 有内容的卡和只有卡面的卡走同一条渲染路径，差别只在数据本身。
 *
 * 无 framer-motion（仓库没这个依赖，也不为一个模块引入），
 * 走 220ms fade + scale（keyframes 在 globals.css，reduced-motion 下整段关掉）。
 */

export type Tab = "decision" | "tutorial" | "faq";

export const TABS: { id: Tab; label: string }[] = [
  { id: "decision", label: "开户决策" },
  { id: "tutorial", label: "申请教程" },
  { id: "faq", label: "常见问题" },
];

const FACT_LABELS: Array<[keyof CryptoCard["detail"]["facts"], string]> = [
  ["cashback", "返现"],
  ["annualFee", "年费"],
  ["kyc", "KYC"],
  ["region", "地区"],
  ["topUp", "充值方式"],
  ["custody", "托管方式"],
];

/**
 * 一格事实。三种状态的渲染必须看得出区别：
 *   verified 正常字色｜partial 正常字色 + 边界说明｜pending 斜体「待核实」
 * 把 partial 和 pending 画成同一种灰，等于把「知道一半」和「完全不知道」抹平。
 */
function Fact({ label, value }: { label: string; value: FactValue }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-600">{label}</p>
      {value.status === "pending" ? (
        <p className="mt-1 text-[13.5px] font-medium italic text-neutral-600">待核实</p>
      ) : (
        <>
          <p className="mt-1 text-[13.5px] font-medium text-neutral-900">{value.value}</p>
          {value.note && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-600">{value.note}</p>
          )}
        </>
      )}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-[13px] italic text-neutral-600">待整理</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {items.map((it) => (
            <li key={it} className="text-[13px] leading-relaxed text-neutral-700">
              · {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_LABEL: Partial<Record<CryptoCard["status"], string>> = {
  waitlist: "等待名单",
  "invite-only": "仅限邀请",
  deprecated: "已停用",
  pending: "内容整理中",
};

export default function CardDetail({
  card,
  tutorialLink,
  tab,
  onTab,
  onClose,
}: {
  card: CryptoCard;
  /** 这张卡在教程导航里的邀请码与注册链接（服务端从 tutorials.json 取，卡片数据里不存） */
  tutorialLink?: CardTutorialLink;
  tab: Tab;
  onTab: (t: Tab) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const tablistRef = useRef<HTMLDivElement | null>(null);

  const d = card.detail;
  // useMemo 不是为了性能：enabled 进了下面 onTablistKey 的依赖数组，
  // 每次渲染新建对象会让那个 useCallback 每帧失效（eslint 也会拦）
  const enabled: Record<Tab, boolean> = useMemo(
    () => ({ decision: true, tutorial: d.tutorial !== null, faq: d.faq !== null }),
    [d.tutorial, d.faq]
  );

  /* 打开时记住焦点来处，关闭后归位；同时锁背景滚动。
     锁滚动要补偿滚动条宽度，否则 body 变窄，背景整页横向抖一下。 */
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

  /* WAI-ARIA tabs：左右方向键在 tablist 内移动，Home/End 跳首尾。
     置灰的 tab 仍然能被方向键走到（ARIA 允许 disabled tab 保持可聚焦），
     但激活是空操作——否则键盘用户根本不知道那两个 tab 存在。 */
  const onTablistKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const i = TABS.findIndex((t) => t.id === tab);
      const next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? TABS.length - 1
            : e.key === "ArrowRight"
              ? (i + 1) % TABS.length
              : (i - 1 + TABS.length) % TABS.length;
      const target = TABS[next];
      tablistRef.current?.querySelector<HTMLElement>(`#cc-tab-${target.id}`)?.focus();
      if (enabled[target.id]) onTab(target.id);
    },
    [tab, onTab, enabled]
  );

  const titleId = `cc-detail-title-${card.slug}`;
  const fullName = card.variant ? `${card.name} · ${card.variant}` : card.name;
  const statusLabel = STATUS_LABEL[card.status];
  // 只收录了卡面的卡没有自己的概述（占位是 TODO）；教程导航里有它的教程时，用教程的那句
  // （指向汇总教程里某一行的卡没有专属概述，这时不显示 TODO 占位，留空）
  const summary = d.summary.startsWith("TODO:") && tutorialLink ? tutorialLink.summary : d.summary;
  // URL 里带了个内容为空的 tab（如直链 ?tab=faq 但这张卡没有 faq）时回落到默认页
  const activeTab = enabled[tab] ? tab : "decision";

  /* 教程区块：教程导航里这张卡的说明、邀请码、注册链接与 X 上的完整教程，
     全部来自 data/tutorials.json。一篇教程有几张卡就列几段
     （Bitget Wallet 新旧两张卡各有各的码），不替访客挑。
     卡片自己有 cta 的（KAST / Bybit）不重复列邀请码和注册按钮——底部已经有了。 */
  const tutorialBlock = tutorialLink ? (
    <section aria-labelledby={`cc-tutorial-${card.slug}`} className="rounded-xl border border-neutral-200 p-4">
      <h3
        id={`cc-tutorial-${card.slug}`}
        className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600"
      >
        教程与邀请码
      </h3>
      <ul className="mt-3 space-y-4">
        {tutorialLink.offers.map((o) => (
          <li key={o.title} className="border-t border-neutral-100 pt-4 first:border-t-0 first:pt-0">
            <p className="text-[13.5px] font-semibold text-neutral-900">{o.title}</p>
            {o.notes.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {o.notes.map((n) => (
                  <li key={n} className="text-[13px] leading-relaxed text-neutral-600">
                    {n}
                  </li>
                ))}
              </ul>
            )}
            {((!d.cta && (o.codes.length > 0 || o.registerUrl)) || o.guides.length > 0) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {!d.cta &&
                  o.codes.map((c) => (
                    <InviteCode
                      key={c}
                      code={c}
                      cardSlug={card.slug}
                      from="cards_tutorial_code"
                      className="max-w-[200px] basis-[160px]"
                    />
                  ))}
                {!d.cta && o.registerUrl && (
                  <a
                    href={o.registerUrl}
                    target="_blank"
                    rel="sponsored nofollow noopener noreferrer"
                    onClick={() =>
                      track("referral_click", { target: card.slug, meta: { from: "cards_tutorial_register" } })
                    }
                    className="shrink-0 rounded-lg bg-neutral-900 px-3.5 py-2 text-[13px] font-medium text-on-solid transition hover:bg-neutral-700"
                  >
                    {o.registerLabel ?? "注册"} ↗
                  </a>
                )}
                {o.guides.map((g) => (
                  <a
                    key={g.url}
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg border border-neutral-300 px-3.5 py-2 text-[13px] font-medium text-neutral-700 transition hover:border-amber-400 hover:text-amber-800"
                  >
                    {g.label} ↗
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-100 pt-3 text-[13px]">
        <a
          href={tutorialLink.telegramDeepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-amber-700 underline-offset-4 transition hover:text-amber-800 hover:underline"
        >
          在 Telegram 获取 ↗
        </a>
        <Link
          href={`/tutorials#${tutorialLink.tutorialSlug}`}
          className="font-medium text-amber-700 underline-offset-4 transition hover:text-amber-800 hover:underline"
        >
          在教程导航看「{tutorialLink.tutorialName}」→
        </Link>
        <span className="text-neutral-600">
          群内发送 <span className="font-mono">{tutorialLink.keyword}</span>
        </span>
      </div>
    </section>

  ) : null;
  // 只收录了卡面的卡，六项事实和开户决策全是「待核实 / 待整理」——教程是它唯一有内容的部分，
  // 放最上面；有实测内容的卡照旧排在风险区块之后
  const tutorialFirst = card.status === "pending";

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
        className="cc-sheet sm:cc-modal flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl outline-none sm:max-h-[88vh] sm:max-w-3xl sm:rounded-2xl"
      >
        {/* 移动端下拉把手（桌面隐藏） */}
        <div data-sheet-handle className="flex shrink-0 cursor-grab touch-none justify-center py-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>

        {/* ── 1. 头部：固定不滚 ─────────────────────────────── */}
        <div className="shrink-0 border-b border-neutral-100">
          <div className="flex items-start gap-4 px-5 pb-4 sm:px-6 sm:pt-6">
            {/* 卡面缩略图复用同一个渲染组件的 compact 变体，不另做一张图 */}
            <div className="w-24 shrink-0 sm:w-32">
              <CardFace card={card} compact />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={titleId} className="text-lg font-semibold tracking-tight text-neutral-900">
                  {fullName}
                </h2>
                {statusLabel && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    {statusLabel}
                  </span>
                )}
              </div>
              {summary && <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{summary}</p>}
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

          {/* notice：只在有硬性前置条件时出现 */}
          {d.notice && (
            <p className="border-t border-neutral-100 bg-neutral-50 px-5 py-2.5 text-[12.5px] leading-relaxed text-neutral-700 sm:px-6">
              {d.notice}
            </p>
          )}
        </div>

        {/* ── 内容区：只有这里滚 ────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {tutorialFirst && tutorialBlock && <div className="mb-6">{tutorialBlock}</div>}

          {/* 2. facts 网格：3 列 → 900px 以下 2 列 → 600px 以下 1 列 */}
          <div className="grid grid-cols-1 gap-2.5 min-[600px]:grid-cols-2 min-[900px]:grid-cols-3">
            {FACT_LABELS.map(([key, label]) => (
              <Fact key={key} label={label} value={d.facts[key]} />
            ))}
          </div>

          {/* 3. Tab 区。内容为 null 的 tab 保留但置灰——直接隐藏会让不同卡片的
                 tab 数量不一致，切卡时整条 tab 栏会跳 */}
          <div
            ref={tablistRef}
            role="tablist"
            aria-label="卡片详情"
            onKeyDown={onTablistKey}
            className="mt-6 flex gap-1 border-b border-neutral-200"
          >
            {TABS.map((t) => {
              const on = enabled[t.id];
              const selected = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  id={`cc-tab-${t.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`cc-panel-${t.id}`}
                  aria-disabled={!on || undefined}
                  tabIndex={selected ? 0 : -1}
                  title={on ? undefined : "内容整理中"}
                  onClick={() => on && onTab(t.id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium transition ${
                    selected
                      ? "border-amber-600 text-neutral-900"
                      : on
                        ? "border-transparent text-neutral-600 hover:text-neutral-700"
                        : "cursor-not-allowed border-transparent text-neutral-400"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="pt-4">
            {/* 4. 开户决策：两列 × 两行，700px 以下堆成单列 */}
            {activeTab === "decision" && (
              <div
                id="cc-panel-decision"
                role="tabpanel"
                aria-labelledby="cc-tab-decision"
                className="grid gap-4 min-[700px]:grid-cols-2"
              >
                <List title="适合谁" items={d.decision.suitableFor} />
                <List title="不适合谁" items={d.decision.notSuitableFor} />
                <List title="优点" items={d.decision.pros} />
                <List title="缺点" items={d.decision.cons} />
              </div>
            )}

            {activeTab === "tutorial" && d.tutorial && (
              <div id="cc-panel-tutorial" role="tabpanel" aria-labelledby="cc-tab-tutorial" className="space-y-5">
                {/* 带序号的时间轴：左侧圆点 + 连线 */}
                <ol className="relative space-y-5 border-l border-neutral-200 pl-6">
                  {d.tutorial.map((s, i) => (
                    <li key={s.title} className="relative">
                      <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-surface text-[11px] font-bold text-neutral-500">
                        {i + 1}
                      </span>
                      <p className="text-[13.5px] font-semibold text-neutral-900">{s.title}</p>
                      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-neutral-600">{s.body}</p>
                      {/* tip 用 emerald：全站是 Stone 暖灰 + amber，没有冷色；emerald 表示「提示 / 成功」 */}
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

              </div>
            )}

            {activeTab === "faq" && d.faq && (
              <div id="cc-panel-faq" role="tabpanel" aria-labelledby="cc-tab-faq" className="space-y-3">
                {d.faq.map((q) => (
                  <details key={q.q} className="rounded-xl border border-neutral-200 p-3">
                    <summary className="cursor-pointer text-[13.5px] font-medium text-neutral-900">{q.q}</summary>
                    <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{q.a}</p>
                  </details>
                ))}
              </div>
            )}
          </div>

          {/* 5. 风险区块。TODO 项照常显示，不隐藏——藏起来等于假装已经核实过 */}
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">风险</p>
            <ul className="mt-1.5 space-y-1">
              {d.risk.map((r) => (
                <li key={r} className="text-[13px] leading-relaxed text-amber-900">
                  · {r}
                </li>
              ))}
            </ul>
          </div>

          {!tutorialFirst && tutorialBlock && <div className="mt-6">{tutorialBlock}</div>}

          {/* 6. 底部：核对时间 + CTA（外跳只发生在这里） */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
            <p className="text-[11.5px] text-neutral-600">
              最后核对：{d.lastVerified ?? <span className="italic">未核对</span>}
            </p>

            {d.cta && (
              <div className="flex min-w-0 items-center gap-2">
                {d.cta.inviteCode && (
                  <InviteCode code={d.cta.inviteCode} cardSlug={card.slug} className="max-w-[190px]" />
                )}
                <a
                  href={d.cta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track("referral_click", { target: card.slug, meta: { from: "cards_detail" } })}
                  className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-medium text-on-solid transition hover:bg-neutral-700"
                >
                  {d.cta.label} ↗
                </a>
              </div>
            )}
          </div>

          <p className="mt-6 text-[11.5px] leading-relaxed text-neutral-600">
            以上为个人实测记录与判断，<b className="font-medium text-neutral-800">不构成投资或理财建议</b>。
            页面内的邀请码与开户链接为返佣链接，你通过它注册我可能获得推荐奖励，
            但不影响你的费用，也不影响上面写的优缺点。
            跨境开户政策、费率与地区可用性随时会变，请以官方页面为准；标注「待核实」的字段表示我尚未实测核实，不做猜测。
          </p>
        </div>
      </div>
    </div>
  );
}
