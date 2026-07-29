/**
 * 客户端埋点发送器（只在 client 组件里 import——它碰 navigator/location）。
 *
 * 用 sendBeacon 而不是 fetch，原因就一个：最重要的两个事件（返佣点击、
 * 购买点击）发生后页面立刻跳走，跳转会取消进行中的 fetch，事件就丢了。
 * sendBeacon 由浏览器接管、跨导航送达，正是为这个场景设计的。
 *
 * 全程静默：埋点失败绝不能干扰访客的点击和跳转。
 */

import type { EventType } from "@/lib/events";

const ENDPOINT = "/api/track";

export interface TrackPayload {
  /** 事件对象：产品 id / 教程 id / 档位 */
  target?: string;
  /** 事件特有字段，无 PII */
  meta?: Record<string, unknown>;
}

export function track(type: EventType, payload: TrackPayload = {}): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      type,
      target: payload.target,
      // query 不发（服务端也会再剥一次）：埋点表不收集意外参数
      path: window.location.pathname,
      meta: payload.meta,
    });

    // text/plain 是刻意的：application/json 会触发 CORS 预检，
    // 而 sendBeacon 不处理预检——同源虽不预检，但保持简单类型最稳。
    // 服务端用 request.text() + JSON.parse 读，不依赖 content-type。
    const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;

    // sendBeacon 不可用或被队列拒绝（超配额）时的兜底
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true, // 同样是为了跨导航存活
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    }).catch(() => {});
  } catch {
    // 埋点永远不该冒泡到 UI
  }
}
