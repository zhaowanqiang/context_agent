"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { isThemedPath, THEME_KEY, type Theme } from "@/lib/theme";

/* 访客的主题选择存在 localStorage，它是「外部系统」——用 useSyncExternalStore 订阅，
   与站内 hash 深链同一套做法。服务端快照固定为 light：首屏 HTML 与默认主题一致，
   夜间用户由 <head> 里的内联脚本在绘制前纠正 data-theme，水合后本组件再对齐按钮状态。 */
const CHANGE_EVENT = "theme:change"; // 同一标签页内 setItem 不触发 storage 事件，得自己广播

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange); // 其它标签页切了主题，这边跟上
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readPreference(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light"; // 隐私模式 / 禁用站点数据
  }
}

const serverPreference = (): Theme => "light";

/**
 * 顶栏的白天 / 夜间切换按钮，同时负责在客户端导航时维护 <html data-theme>。
 *
 * 工作台页面永久浅色：这里把 data-theme 钉回 light 并且不渲染按钮；
 * 回到公开页时按访客原先的选择恢复（选择本身一直留在 localStorage 里没动）。
 */
export default function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, readPreference, serverPreference);
  const themed = isThemedPath(usePathname());
  const applied: Theme = themed ? preference : "light";

  // layout effect：赶在浏览器绘制前改，公开页 ↔ 工作台来回跳不会闪一帧错的主题
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = applied;
  }, [applied]);

  if (!themed) return null;

  const dark = preference === "dark";

  function toggle() {
    try {
      localStorage.setItem(THEME_KEY, dark ? "light" : "dark");
    } catch {
      return; // 存不下来就不切：切了刷新又弹回去，比不切更怪
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // 名称固定为「夜间模式」，开关状态由 aria-pressed 表达——读屏读作「夜间模式，已按下」
      aria-label="夜间模式"
      aria-pressed={dark}
      title={dark ? "切换到白天模式" : "切换到夜间模式"}
      data-theme-toggle
      className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
    >
      {dark ? (
        <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <circle cx="10" cy="10" r="3.4" />
          <path d="M10 2.2v2M10 15.8v2M2.2 10h2M15.8 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
          <path d="M16.6 11.9A7 7 0 0 1 8.1 3.4a7 7 0 1 0 8.5 8.5Z" />
        </svg>
      )}
    </button>
  );
}
