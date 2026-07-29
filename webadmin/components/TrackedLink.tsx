"use client";

import type { AnchorHTMLAttributes } from "react";
import type { EventType } from "@/lib/events";
import { track } from "@/lib/track";

interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  event: EventType;
  /** 事件对象：产品 id / 教程 id */
  target_?: string;
  meta?: Record<string, unknown>;
}

/**
 * 带埋点的外链。给服务端组件用——它们不能直接挂 onClick。
 *
 * 属性名用 target_ 而不是 target：<a target="_blank"> 已经占了这个名字，
 * 撞名会让「新窗口打开」被埋点参数覆盖，是个查起来很烦的 bug。
 *
 * 不拦截默认行为：跳转照常发生，事件靠 sendBeacon 跨导航送达（见 lib/track.ts）。
 * 埋点失败也不影响跳转——转化本身永远比转化统计重要。
 */
export default function TrackedLink({ event, target_, meta, onClick, ...rest }: Props) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        track(event, { target: target_, meta });
        onClick?.(e);
      }}
    />
  );
}
