import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { isSystemCall } from "./systemContext";

/**
 * 服务端组件里判断当前请求是否已通过访问码登录。
 * 与 proxy.ts / actions/auth.ts 同一套约定：cookie 存 SHA-256(ADMIN_ACCESS_CODE)。
 * 公开层页面（首页/文章/关于）proxy 直接放行，靠这个函数决定"是否多渲染工作台区块"。
 * 未配置 ADMIN_ACCESS_CODE 时视为已登录（与 proxy 的放行行为保持一致）。
 */
export async function isAdminAuthed(): Promise<boolean> {
  // 公网纯门面实例永远视为未登录：否则「未配置访问码=放行」的本机约定
  // 会让不配 ADMIN_ACCESS_CODE 的公网实例对所有人渲染工作台导航
  if (process.env.PUBLIC_FACADE === "1") return false;
  const code = process.env.ADMIN_ACCESS_CODE;
  if (!code) return true;
  const got = (await cookies()).get("admin_auth")?.value;
  if (!got) return false;
  return got === createHash("sha256").update(code).digest("hex");
}

/**
 * 工作台 server action 的自带闸门：不满足登录态直接抛，调用方拿不到任何数据。
 *
 * 为什么每个 action 都要自己判一次，而不是只靠 proxy.ts：
 * proxy 的 matcher 排除了公开路径（/、/posts 等），而 server action 是
 * POST 到当前页面路径的——打到 / 的 action 调用根本不进 proxy。目前挡住
 * 跨路由调用的是 Next 的 action-路由作用域绑定，那是框架实现细节
 * （本项目还跑在 canary 上），升级后行为变了不会有任何报错提醒。
 * 这道闸是不依赖框架行为的那一层。
 */
export async function requireAdmin(): Promise<void> {
  if (isSystemCall()) return; // 定时任务：无请求上下文，见 lib/systemContext.ts
  if (!(await isAdminAuthed())) {
    throw new Error("unauthorized：该操作需要管理员访问码");
  }
}
