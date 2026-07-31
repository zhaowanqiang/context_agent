"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CryptoCard } from "@/data/crypto-cards";
import { glowOf } from "@/lib/cardFace";
import CardFace from "./CardFace";

const MAX_TILT = 7; // deg。再大就不像卡片倾斜，像页面翻了

/**
 * 网格里的一张卡：卡面 + 精简信息区共用同一个容器。
 *
 * 状态不再用灰色 pill 标签表达——43 张卡里 40 张挂「内容整理中」，
 * 标签本身成了噪音，反而把真正能用的 3 张卡淹了。
 * 改成视觉权重：资料完整的全饱和，只有卡面的降饱和 + 降透明 + 右上一个 6px 小点。
 */
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

  /* 关键：pointermove 里绝不 setState。坐标只进 ref，用 rAF 节流成每帧一次，
     再直接写 CSS 自定义属性——整条链路不触发 React 重渲染，动画跑在合成器上。
     阴影偏移用无单位数字（--cc-sx/--cc-sy），CSS 那边 calc(… * 1px)：
     deg 不能直接参与 px 运算，所以倾斜角和阴影偏移各写一份。 */
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
    el.style.setProperty("--cc-sx", `${(0.5 - px) * 16}`);
    el.style.setProperty("--cc-sy", `${(0.5 - py) * 10 + 20}`);
    el.style.setProperty("--cc-glare", "0.28");
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
    // 归零 → CSS 负责 400ms 回弹（比进入的 240ms 慢，手感上「松手才慢慢回位」）
    el.style.setProperty("--cc-rx", "0deg");
    el.style.setProperty("--cc-ry", "0deg");
    el.style.setProperty("--cc-sx", "0");
    el.style.setProperty("--cc-sy", "20");
    el.style.setProperty("--cc-glare", "0");
  }, []);

  const isPending = card.status === "pending";
  const fullName = card.variant ? `${card.name} · ${card.variant}` : card.name;
  // 网格态最多两个标签，其余进详情面板——信息密度优先
  const chips = card.badges.slice(0, 2);
  const hiddenChips = card.badges.length - chips.length;

  return (
    <article
      ref={tileRef}
      onPointerMove={onMove}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      data-pending={isPending || undefined}
      className="cc-tile relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-3.5"
      style={
        {
          perspective: "1200px",
          "--cc-glow": glowOf(card.faceStyle),
        } as React.CSSProperties
      }
    >
      {/* 覆盖整卡的命中区，z-10 压在卡面之上。
          原先它是 z-0，而卡面是 relative（z-auto）且在 DOM 里排在后面——
          同层级按 DOM 顺序绘制，卡面盖住了按钮，导致点卡面完全没反应，
          整卡只有下半部约 45% 能打开详情。这是 KAST/Bybit「点了就外跳」的根因之一。

          用真 <button> 而不是给 <article> 加 role="button"：后者会让卡内的
          交互元素变成「嵌套交互控件」，axe 直接判失败。
          焦点环画在 .cc-tile 自己身上（见 globals.css）——content-visibility 带来的
          paint containment 会把子元素画到边界外的 ring 裁掉，画在容器自身则不受影响。 */}
      <button
        type="button"
        onClick={onOpen}
        title={isPending ? "内容整理中：这张卡目前只收录了卡面信息" : undefined}
        className="cc-hit absolute inset-0 z-10 rounded-2xl focus:outline-none"
      >
        <span className="sr-only">
          查看 {fullName} 详情{isPending ? "（内容整理中）" : ""}
        </span>
        {/* 状态点画在命中区内部：放在外面会再挖掉一小块不可点区域 */}
        {isPending && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400 ring-2 ring-white/70"
          />
        )}
      </button>

      <CardFace card={card} />

      <h3 className="pointer-events-none mt-3 flex items-baseline gap-1.5 text-[15px] font-semibold tracking-tight text-neutral-900">
        <span className="truncate">{card.name}</span>
        {card.variant && (
          <span className="shrink-0 text-[11.5px] font-normal text-neutral-600">{card.variant}</span>
        )}
      </h3>

      {/* 网格态不再有任何外跳入口：点卡片任意位置都是打开详情，
          外跳只发生在详情面板底部的 CTA 上。这样 43 张卡的信息密度也一致了。 */}
      <div className="mt-auto flex items-center gap-2 pt-2.5">
        <div className="pointer-events-none flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {chips.map((b, i) => (
            <span
              key={b}
              className="cc-chip truncate rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800"
              style={{ "--cc-i": i } as React.CSSProperties}
            >
              {b}
            </span>
          ))}
          {hiddenChips > 0 && <span className="text-[11px] text-neutral-600">+{hiddenChips}</span>}
        </div>

        <span className="pointer-events-none shrink-0 text-[12.5px] font-medium text-neutral-600">
          详情 <span className="cc-arrow inline-block">→</span>
        </span>
      </div>
    </article>
  );
}
