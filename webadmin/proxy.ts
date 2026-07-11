import { NextResponse, type NextRequest } from "next/server";

/**
 * 访问码鉴权（分层）：cookie 里存 SHA-256(ADMIN_ACCESS_CODE)，比对不上就去 /login。
 * - 公开层（个人网站门面）：首页、/posts、/about、/decider、RSS/sitemap/robots —— matcher 直接放行，
 *   首页的工作台区块由 lib/adminAuth.ts 在渲染时按登录态增减
 * - 私有层（工作台）：/agent、/monitor 及其余一切照旧拦截
 * - /api/monitor/* 走自己的 x-monitor-token（外部推送无 cookie），不在这里管
 * - 未配置 ADMIN_ACCESS_CODE 时放行（保持旧行为），启动后警告一次
 */

const COOKIE_NAME = "admin_auth";

// 模块级缓存：env 不变时不重复算哈希（proxy 每个请求都跑）
let cachedCode: string | null = null;
let cachedHash: string | null = null;

async function expectedHash(code: string): Promise<string> {
  if (cachedCode !== code || cachedHash === null) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
    cachedHash = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    cachedCode = code;
  }
  return cachedHash;
}

let warnedNoCode = false;

export async function proxy(request: NextRequest) {
  const code = process.env.ADMIN_ACCESS_CODE;
  if (!code) {
    if (!warnedNoCode) {
      warnedNoCode = true;
      console.warn(
        "[auth] 未配置 ADMIN_ACCESS_CODE，后台对局域网无访问验证 —— 在 webadmin/.env.local 里加一条随机字符串"
      );
    }
    return NextResponse.next();
  }

  const got = request.cookies.get(COOKIE_NAME)?.value;
  if (got && got === (await expectedHash(code))) return NextResponse.next();

  const login = new URL("/login", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // 排除：公开层路由（含根路径，用 $ 精确匹配避免误放行 /agent 等）、
  // 登录页本身、监控推送 API（token 鉴权）、Next 静态资源、favicon
  matcher: [
    "/((?!$|posts|about|decider|rss\\.xml|sitemap\\.xml|robots\\.txt|login|api/monitor|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
