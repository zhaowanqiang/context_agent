import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * 「进程内部调用」标记。
 *
 * 背景：定时任务（instrumentation.ts → lib/autopilot.ts）会直接调用
 * app/actions/* 里的函数，那条路径没有 HTTP 请求上下文，cookies() 会抛。
 * 而 requireAdmin() 又必须对真实请求失败即拒绝——两个需求靠这个上下文区分。
 *
 * 为什么安全：AsyncLocalStorage 的 store 只在 runAsSystem() 的回调内可见，
 * HTTP 请求的执行栈永远不经过那个回调，所以外部请求无论带什么参数、
 * 什么 header 都进不了这个上下文——不是靠校验，是靠根本够不着。
 */
const systemCall = new AsyncLocalStorage<true>();

/** 把定时任务/启动补跑的整段工作包进来：其内部对 action 的调用免鉴权 */
export function runAsSystem<T>(fn: () => Promise<T>): Promise<T> {
  return systemCall.run(true, fn);
}

/** 当前执行栈是否来自 runAsSystem（而非 HTTP 请求） */
export function isSystemCall(): boolean {
  return systemCall.getStore() === true;
}
