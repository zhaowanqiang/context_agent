import { isEventType, recordEvent } from "@/lib/events";

/**
 * 埋点收集端点：公开层访客（无 cookie、无鉴权）POST 一条行为事件。
 *
 * 必须放行到公开层——它服务的正是访客，而且公网门面实例（PUBLIC_FACADE=1）
 * 才是流量真正发生的地方。proxy.ts 的 matcher 已把 api/track 排除在拦截外，
 * 一旦被拦下，线上就是「埋了但一条数据都没有」，且没有任何报错。
 *
 * 防滥用三道：白名单 type（lib/events.ts）、请求体大小上限、按 IP 限流。
 * 都不是强安全边界，只是让「随手灌垃圾」变得不划算——真要防得靠 WAF。
 */

// POST handler 本就永远动态，不需要 dynamic 配置（对齐 api/checkout 的写法）
export const runtime = "nodejs";

/** 请求体上限：一条事件正常几百字节 */
const MAX_BODY_BYTES = 4000;
/** 限流：单 IP 每分钟条数。正常访客一次会话打不了几条，60 已经很宽松 */
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

// 内存计数器。serverless 上每个实例各算各的（所以实际额度是 N×RATE_LIMIT），
// 够挡住随手写的脚本；换真限流要上 Redis/Upstash，当前量级不值得。
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || now >= cur.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    // 顺手清过期键，免得 Map 随 IP 数无限涨（长驻的本机实例尤其要紧）
    if (hits.size > 1000) {
      for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
    }
    return false;
  }
  cur.count += 1;
  return cur.count > RATE_LIMIT;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  // x-forwarded-for 可能是「客户端, 代理1, 代理2」，取第一段
  return fwd?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return new Response(null, { status: 429 });
  }

  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (body === null || typeof body !== "object") {
    return new Response(null, { status: 400 });
  }

  const { type, target, path, meta } = body as Record<string, unknown>;
  // 400 而不是静默吞掉：加新埋点时敲错 type 要立刻能发现。
  // 白名单本来就写在客户端 JS 里，这个回显不算泄漏什么。
  if (!isEventType(type)) return new Response(null, { status: 400 });

  await recordEvent({ type, target, path, meta });
  // 一律 204：埋点结果不影响访客，写没写进去由服务端日志兜底
  return new Response(null, { status: 204 });
}
