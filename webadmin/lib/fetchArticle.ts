import "server-only";
import { smartFetch } from "./proxyFetch";

export interface FetchedArticle {
  text: string;
  images: string[]; // 正文图片 URL（已过滤图标/头像/二维码，最多 6 张）
}

/** 抓取选题原文：正文文本 + 正文图片。失败返回 null 由人工粘贴兜底。 */
export async function fetchArticle(url: string): Promise<FetchedArticle | null> {
  try {
    // 外站原文（Reddit/HN 链接等）自动回落本地代理
    const res = await smartFetch(url, 15_000);
    if (!res.ok) return null;
    const html = await res.text();

    // 优先取 <article>，其次常见正文容器，最后整个 body
    const scope =
      pick(html, /<article[\s\S]*?<\/article>/i) ??
      pick(html, /<div[^>]+(?:class|id)="[^"]*(?:article|content|post-body|rich_media)[^"]*"[\s\S]*?<\/div>/i) ??
      pick(html, /<body[\s\S]*?<\/body>/i) ??
      html;

    const images = extractImages(scope, url);

    const text = scope
      .replace(/<(script|style|noscript|svg|iframe|nav|header|footer|aside)[\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|section)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n\s*/g, "\n\n")
      .trim();

    // 太短说明抽取失败（比如整页是 JS 渲染）
    if (text.length < 200) return null;
    return { text: text.slice(0, 6000), images };
  } catch {
    return null;
  }
}

/** 抽取正文图片：兼容懒加载（data-src / data-original）与 srcset，过滤图标类噪声 */
function extractImages(scope: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const imgTags = scope.match(/<img[^>]*>/gi) ?? [];
  for (const tag of imgTags) {
    const src =
      pickFromSrcset(attr(tag, "srcset") ?? attr(tag, "data-srcset")) ??
      attr(tag, "data-src") ??
      attr(tag, "data-original") ??
      attr(tag, "data-lazy-src") ??
      attr(tag, "src");
    if (!src || src.startsWith("data:")) continue;
    let abs: string;
    try {
      abs = new URL(src, baseUrl).toString();
    } catch {
      continue;
    }
    // 只要正文配图，滤掉图标/头像/logo/二维码/表情
    // 扩展名后允许 CDN 处理后缀（如 ifanr 的 .png!720）
    if (!/\.(jpe?g|png|webp)([!?#]|$)/i.test(abs)) continue;
    if (/logo|avatar|icon|qrcode|emoji|banner-ad|sponsor/i.test(abs)) continue;
    if (!urls.includes(abs)) urls.push(abs);
    if (urls.length >= 6) break;
  }
  return urls;
}

/** 从 srcset 里挑一个中等宽度的候选（优先 768–1024w，公众号粘贴够用且不至于过大） */
function pickFromSrcset(srcset: string | null): string | null {
  if (!srcset) return null;
  const candidates = srcset
    .split(",")
    .map((part) => {
      const [url, size] = part.trim().split(/\s+/);
      return { url, width: size?.endsWith("w") ? parseInt(size) : 0 };
    })
    .filter((c) => c.url);
  if (candidates.length === 0) return null;
  const mid = candidates.filter((c) => c.width >= 600 && c.width <= 1200);
  if (mid.length > 0) return mid.sort((a, b) => b.width - a.width)[0].url;
  return candidates.sort((a, b) => b.width - a.width)[0].url;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return m ? m[1] : null;
}

function pick(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[0] : null;
}
