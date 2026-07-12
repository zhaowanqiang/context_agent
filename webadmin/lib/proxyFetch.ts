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
    // 代理路径重试一次：本地代理节点偶发抖动/超时是常态，别让单次失败污染整期简报
    try {
      return await curlFetch(url, proxy, timeoutMs + 15_000);
    } catch {
      await new Promise((r) => setTimeout(r, 1_500));
      return curlFetch(url, proxy, timeoutMs + 15_000);
    }
  }
}

/**
 * 强制走代理 curl（跳过直连）：给「直连能通但返回错误内容」的站点用——
 * 例如 bing.com 国内直连 200 但被重定向到 cn.bing 首页，smartFetch 的
 * 「失败才回落」逻辑对这种软失败无感。
 */
export async function proxyFetch(url: string, timeoutMs = 15_000): Promise<Response> {
  const proxy = process.env.AGENT_FETCH_PROXY;
  if (!proxy) throw new Error(`未配置 AGENT_FETCH_PROXY，无法代理抓取：${url}`);
  try {
    return await curlFetch(url, proxy, timeoutMs + 15_000);
  } catch {
    await new Promise((r) => setTimeout(r, 1_500));
    return curlFetch(url, proxy, timeoutMs + 15_000);
  }
}

async function curlFetch(url: string, proxy: string, timeoutMs: number): Promise<Response> {
  let stdout: string;
  try {
    ({ stdout } = await execFileP(
      "curl",
      [
        "-sS", // -s 静默进度但 -S 保留错误：否则失败时只剩 "Command failed" 无从排查
        "-L",
        "-m", String(Math.ceil(timeoutMs / 1000)),
        "-x", proxy,
        "-A", UA,
        "-H", "Accept: text/html,application/xhtml+xml,application/xml,*/*",
        "-w", "\n__HTTP_STATUS__%{http_code}",
        url,
      ],
      { maxBuffer: 20 * 1024 * 1024, windowsHide: true }
    ));
  } catch (e) {
    // execFile 的原始 message 是整条命令行（含完整 URL），塞进简报没法读；
    // 换成 curl 自己的错误行（如 "curl: (28) Operation timed out"）
    const err = e as Error & { code?: number | string; stderr?: string };
    const line = (err.stderr ?? "").trim().split("\n").filter(Boolean).pop();
    throw new Error(`代理抓取失败：${line || `curl 退出码 ${err.code ?? "未知"}`}`);
  }
  const marker = stdout.lastIndexOf("\n__HTTP_STATUS__");
  const status = marker >= 0 ? parseInt(stdout.slice(marker + 16).trim(), 10) : 0;
  const body = marker >= 0 ? stdout.slice(0, marker) : stdout;
  return new Response(body, { status: status >= 100 && status <= 599 ? status : 599 });
}
