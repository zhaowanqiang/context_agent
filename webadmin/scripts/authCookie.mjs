// 脚本共用：从 .env.local 读 ADMIN_ACCESS_CODE，算出 proxy.ts 认的 admin_auth cookie。
// 用法：await setAuthCookie(browser);  （未配置访问码时空操作）
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export function readEnvLocal() {
  const env = {};
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export async function setAuthCookie(browser, host = "localhost") {
  const code = readEnvLocal().ADMIN_ACCESS_CODE;
  if (!code) return;
  await browser.setCookie({
    name: "admin_auth",
    value: createHash("sha256").update(code).digest("hex"),
    domain: host,
    path: "/",
  });
}
