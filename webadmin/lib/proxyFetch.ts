import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * 智能抓取：先直连（国内源快且不占代理流量），失败再经本地代理走 curl。
 * 为什么是 curl 而不是 Node fetch 走代理：Reddit 等站的 WAF 按 TLS 指纹拦截
 * Node/undici 客户端（403），curl 的指纹能正常通过；Windows 10+ 自带 curl.exe。
 * 代理地址由 .env.local 的 AGENT_FETCH_PROXY 提供，不配则只直连。
 */
export async function smartFetch(url: string, timeoutMs = 15_000): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    const proxy = process.env.AGENT_FETCH_PROXY;
    if (!proxy) throw new Error(`直连失败且未配置 AGENT_FETCH_PROXY：${url}`);
    return curlFetch(url, proxy, timeoutMs + 15_000);
  }
}

async function curlFetch(url: string, proxy: string, timeoutMs: number): Promise<Response> {
  const { stdout } = await execFileP(
    "curl",
    [
      "-s",
      "-L",
      "-m", String(Math.ceil(timeoutMs / 1000)),
      "-x", proxy,
      "-A", UA,
      "-H", "Accept: text/html,application/xhtml+xml,application/xml,*/*",
      "-w", "\n__HTTP_STATUS__%{http_code}",
      url,
    ],
    { maxBuffer: 20 * 1024 * 1024, windowsHide: true }
  );
  const marker = stdout.lastIndexOf("\n__HTTP_STATUS__");
  const status = marker >= 0 ? parseInt(stdout.slice(marker + 16).trim(), 10) : 0;
  const body = marker >= 0 ? stdout.slice(0, marker) : stdout;
  return new Response(body, { status: status >= 100 && status <= 599 ? status : 599 });
}
