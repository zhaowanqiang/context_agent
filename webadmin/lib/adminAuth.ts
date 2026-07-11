import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";

/**
 * 服务端组件里判断当前请求是否已通过访问码登录。
 * 与 proxy.ts / actions/auth.ts 同一套约定：cookie 存 SHA-256(ADMIN_ACCESS_CODE)。
 * 公开层页面（首页/文章/关于）proxy 直接放行，靠这个函数决定"是否多渲染工作台区块"。
 * 未配置 ADMIN_ACCESS_CODE 时视为已登录（与 proxy 的放行行为保持一致）。
 */
export async function isAdminAuthed(): Promise<boolean> {
  const code = process.env.ADMIN_ACCESS_CODE;
  if (!code) return true;
  const got = (await cookies()).get("admin_auth")?.value;
  if (!got) return false;
  return got === createHash("sha256").update(code).digest("hex");
}
