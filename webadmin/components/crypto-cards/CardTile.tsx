"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CryptoCard } from "@/data/crypto-cards";
import { track } from "@/lib/track";
import CardArt from "./CardArt";
import InviteCode from "./InviteCode";

const MAX_TILT = 8; // deg

const STATUS: Record<CryptoCard["status"], { label: string; cta: string; tone: string } | null> = {
  live: null, // 正常状态不打角标
  waitlist: { label: "等待名单", cta: "加入等待名单", tone: "bg-amber-100 text-amber-800" },
  "invite-only": { label: "仅限邀请", cta: "看怎么拿邀请码", tone: "bg-amber-100 text-amber-800" },
  deprecated: { label: "已停用", cta: "查看详情", tone: "bg-neutral-200 text-neutral-600" },
  // 只收录了卡面：CTA 绝不能写成「立即领取」——那等于暗示这张卡已经可以开
  pending: { label: "内容整理中", cta: "查看详情", tone: "bg-neutral-200 text-neutral-600" },
};

export default function CardTile({ card, onOpen }: { card: CryptoCard; onOpen: () => void }) {
  const tileRef = useRef<HTMLElement | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const motionOk = useRef(true);

  useEffect(() => {
    // 指针跟随只在「真有悬停能力」且「用户没要求减少动效」时才跑。
    // CSS 那边也拦了一道，这里再拦是为了连计算都省掉。
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { motionOk.current = hover.matches && !reduce.matches; };
    sync();
    hover.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    return () => {
      hover.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  /* 关键：mousemove 里绝不 setState。只把坐标存进 ref，用 rAF 节流成每帧一次，
     再直接写 CSS 变量——整条链路不触发 React 重渲染，动画跑在合成器上。 */
  const apply = useCallback(() => {
    frame.current = null;
    const el = tileRef.current;
    const p = pending.current;
    if (!el || !p) return;
    const r = el.getBoundingClientRect();
    const px = (p.x - r.left) / r.width;
    const py = (p.y - r.top) / r.height;
    el.style.setProperty("--cc-ry", `${(px - 0.5) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--cc-rx", `${(0.5 - py) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--cc-mx", `${px * 100}%`);
    el.style.setProperty("--cc-my", `${py * 100}%`);
    el.style.setProperty("--cc-glare", "0.35");
  }, []);

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (!motionOk.current) return;
      pending.current = { x: e.clientX, y: e.clientY };
      if (frame.current === null) frame.current = requestAnimationFrame(apply);
    },
    [apply]
  );

  const onEnter = useCallback(() => {
    const el = tileRef.current;
    if (!el || !motionOk.current) return;
    // shine 每次进入只扫一次：动画结束后摘掉 class，下次进入才能重新触发
    el.classList.add("cc-shine-run");
    const done = () => el.classList.remove("cc-shine-run");
    el.addEventListener("animationend", done, { once: true });
  }, []);

  const onLeave = useCallback(() => {
    const el = tileRef.current;
    if (!el) return;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    // 归零 → CSS transition 负责 300ms 弹性回位
    el.style.setProperty("--cc-rx", "0deg");
    el.style.setProperty("--cc-ry", "0deg");
    el.style.setProperty("--cc-glare", "0");
  }, []);

  const badge = STATUS[card.status];
  const ctaLabel = badge?.cta ?? "立即领取";
  const href = card.invite?.url;
  // 同品牌多卡面（XPlace ×2、Zen ×2）和 9 张「待确认」重名，
  // 卡名后缀上 variant 才能让标题和读屏标签互相区分得开
  const fullName = card.variant ? `${card.name} · ${card.variant}` : card.name;

  return (
    <article
      ref={tileRef}
      onPointerMove={onMove}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      className="cc-tile relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-4"
      style={{ perspective: "1000px" }}
    >
      {/* 覆盖整卡的命中区。用真 <button> 而不是给 <article> 加 role="button"：
          后者会让卡内的链接和复制按钮变成「嵌套交互控件」，axe 直接判失败。
          z-0 压在下面，CTA / 复制按钮 z-10 浮在上面，各点各的。 */}
      <button
        type="button"
        onClick={onOpen}
        className="cc-hit absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
      >
        <span className="sr-only">查看 {fullName} 详情</span>
      </button>

      <CardArt card={card} />

      {badge && (
        <span className={`absolute right-6 top-6 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.tone}`}>
          {badge.label}
        </span>
      )}

      <h3 className="pointer-events-none mt-3 text-base font-semibold tracking-tight text-neutral-900">
        {card.name}
        {card.variant && (
          <span className="ml-1.5 text-[12px] font-normal text-neutral-500">{card.variant}</span>
        )}
      </h3>

      <div className="pointer-events-none mt-2 flex flex-wrap gap-1.5">
        {card.badges.map((b, i) => (
          <span
            key={b}
            className="cc-chip rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800"
            style={{ "--cc-i": i } as React.CSSProperties}
          >
            {b}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-3">
        {card.invite ? (
          <InviteCode code={card.invite.code} cardSlug={card.slug} className="relative z-10" />
        ) : (
          <p className="min-w-0 flex-1 truncate text-[12px] text-neutral-600" title={card.signupNote}>
            {card.signupNote ?? (card.status === "pending" ? "开户信息整理中" : "开户入口见详情")}
          </p>
        )}

        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              track("referral_click", { target: card.slug, meta: { from: "cards_tile" } });
            }}
            className="relative z-10 shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-neutral-700"
          >
            {ctaLabel} <span className="cc-arrow inline-block">↗</span>
          </a>
        ) : (
          <span className="pointer-events-none shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-[13px] font-medium text-neutral-600">
            {ctaLabel} <span className="cc-arrow inline-block">→</span>
          </span>
        )}
      </div>
    </article>
  );
}
