import { NextResponse, type NextRequest } from "next/server";

/**
 * 访问码鉴权（分层）：cookie 里存 SHA-256(ADMIN_ACCESS_CODE)，比对不上就去 /login。
 * - 公开层（个人网站门面）：首页、/posts、/now、/about、/decider、/guides、/cards、RSS/sitemap/robots
 *   —— matcher 直接放行，首页的工作台区块由 lib/adminAuth.ts 在渲染时按登录态增减
 * - 私有层（工作台）：/agent、/monitor、/import 及其余一切照旧拦截。
 *   注意 /guides 是公开阅读层，写它的导入器在 /import——两者分开路由，
 *   否则 matcher 按前缀放行会把编辑器一起放出去
 * - 未配置 ADMIN_ACCESS_CODE 时 fail-closed：私有层连同登录页一律 503，
 *   而不是放行（配置缺失必须"进不去"，不能"随便进"）
 * - /api/monitor/* 走自己的 x-monitor-token（外部推送无 cookie），不在这里管
 * - /api/track 是公开层的埋点收集端点，必须放行：它服务的就是未登录访客，
 *   而且流量真正发生在公网门面实例上——被拦下就是「埋了但一条数据都没有」，
 *   且不会有任何报错。自身防护靠白名单 + 限流（见 app/api/track/route.ts）
 * - /api/checkout、/api/webhooks/* 是 decider 的支付链路，必须放行：
 *   前者自己查 Supabase 登录态，后者验 Creem HMAC 签名，各有各的鉴权；
 *   一旦被这里拦下，门面模式会把它们 404 掉 —— 支付会静默失效，没有任何报错
 *
 * PUBLIC_FACADE=1（公网部署实例用，如 Vercel）：纯门面模式——
 * 工作台路由和登录页一律 404，公网上不暴露"这里有后台"这个事实本身；
 * 工作台只活在本机实例。配套：instrumentation.ts 在该模式下跳过全部 cron。
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
  const { pathname } = request.nextUrl;
  const facade = process.env.PUBLIC_FACADE === "1";
  // 登录页也流经 proxy（matcher 不再排除），但它的处理时机在「未配码」之后：
  // 没配码时登录本身就不可能成功，先让运维看见真正的原因
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  // 门面模式：私有路由与登录页一律 404（真状态码，非 soft-404），
  // 公网上不暴露"这里有后台"这个事实本身
  if (facade) return new NextResponse(null, { status: 404 });

  // fail-closed：未配置访问码 = 整个私有层拒绝服务（含登录页）。
  // 旧行为是放行——那意味着任何能连到本机/局域网的人都能直接进工作台，
  // 而这恰恰是最容易发生的场景：新克隆的仓库、忘了填 .env.local、
  // 变量名敲错。配置缺失必须是"进不去"，不能是"随便进"。
  const code = process.env.ADMIN_ACCESS_CODE;
  if (!code) {
    if (!warnedNoCode) {
      warnedNoCode = true;
      console.error(
        "[auth] 未配置 ADMIN_ACCESS_CODE —— 私有层已全部拒绝访问（503）。在 webadmin/.env.local 里加一条随机字符串后重启"
      );
    }
    return new NextResponse(
      "服务端未配置 ADMIN_ACCESS_CODE，后台已停用。请在 webadmin/.env.local 配置后重启。",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  // 配了码才谈得上登录：放行登录页，让用户输码
  if (isLogin) return NextResponse.next();

  const got = request.cookies.get(COOKIE_NAME)?.value;
  if (got && got === (await expectedHash(code))) return NextResponse.next();

  const login = new URL("/login", request.url);
  const { search } = request.nextUrl;
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // 排除：公开层路由（含根路径，用 $ 精确匹配避免误放行 /agent 等）、
  // 监控推送 API（token 鉴权）、Next 静态资源、favicon。
  // /login 不排除——由 proxy 代码处理（门面模式要能把它 404 掉）
  matcher: [
    "/((?!$|posts|about|now|decider|guides|cards|opengraph-image|rss\\.xml|sitemap\\.xml|robots\\.txt|api/monitor|api/track|api/checkout|api/webhooks|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
