import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * 监控简报 API 的共享鉴权：Cowork 定时任务带 x-monitor-token 头访问。
 * 校验失败时返回错误 Response，通过时返回 null（调用方继续处理）。
 * 比较走 SHA-256 + timingSafeEqual（等长化 + 常量时间），与 actions/auth.ts 同标准。
 */
export function checkMonitorToken(req: Request): Response | null {
  const expected = process.env.MONITOR_INGEST_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "服务端未配置 MONITOR_INGEST_TOKEN —— 在 webadmin/.env.local 里加一条随机字符串" },
      { status: 503 }
    );
  }
  const got = req.headers.get("x-monitor-token") ?? "";
  const gotHash = createHash("sha256").update(got).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(gotHash, expectedHash)) {
    return Response.json({ error: "token 不正确" }, { status: 401 });
  }
  return null;
}
