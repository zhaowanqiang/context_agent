"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 详情面板外壳：桌面居中弹窗，移动端从底部升起的抽屉（可下拉关闭）。
 *
 * 交互与 crypto-cards/CardDetail 一致——焦点陷阱、Esc 关闭、背景锁滚（补滚动条宽度）、
 * 关闭后焦点归位；动画复用 globals.css 的 .cc-overlay / .cc-sheet / .cc-modal
 * （prefers-reduced-motion 下整段关掉）。
 *
 * 为什么单独抽出来：同一套外壳在 CardDetail 和原 PhoneDetail 里已经各写了一份，
 * 教程导航是第三个要用的地方，再抄一遍就是三份要同步改的焦点陷阱。
 * CardDetail 暂时没迁过来（它的卡面头部和 tab 键盘逻辑耦合较深），新面板一律用这个。
 * 颜色全部走语义变量，随主题切换。
 */
export default function DetailSheet({
  titleId,
  onClose,
  header,
  children,
}: {
  /** 面板标题元素的 id（aria-labelledby 用），由调用方在 header 里渲染 */
  titleId: string;
  onClose: () => void;
  /** 固定不滚的头部内容；关闭按钮由外壳提供 */
  header: ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

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
      } else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  /* 移动端下拉关闭：拖动过程中直接改 style，不进 React 状态 */
  useEffect(() => {
    const el = dialogRef.current;
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

  return (
    <div
      className="cc-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="cc-sheet sm:cc-modal flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl outline-none sm:max-h-[88vh] sm:max-w-2xl sm:rounded-2xl"
      >
        {/* 移动端下拉把手（桌面隐藏） */}
        <div data-sheet-handle className="flex shrink-0 cursor-grab touch-none justify-center py-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </div>

        <div className="flex shrink-0 items-start gap-3 border-b border-line px-5 pb-4 sm:px-6 sm:pt-6">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            // 44px 触控目标：手机上关闭按钮是最常点的控件
            className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-muted hover:text-ink-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mark"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
