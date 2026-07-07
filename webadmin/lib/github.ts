import "server-only";
import { smartFetch } from "./proxyFetch";
import type { Source } from "./types";

/**
 * GitHub 热门库源：
 * - 源的 feed_url 指向 github.com/trending（可带 ?since=daily 等参数；
 *   两轨各建一个源，X 轨的 URL 加 #x 后缀以绕开 feed_url 唯一约束，抓取时 hash 不参与请求）
 * - 抓取解析 trending 页 HTML 进选题池，guid 用仓库全名 —— 同一个库只进池一次，不重复分析
 * - 建 run 时不抓 repo 网页（噪声太多），走 GitHub API 拿仓库档案 + README 当素材
 */

export function isGitHubTrendingUrl(url: string): boolean {
  return url.startsWith("https://github.com/trending");
}

/** feed_items 行（与 rss.ts 的 RSS 行同构） */
export interface TrendingRow {
  source_id: string;
  track: Source["track"];
  guid: string;
  title: string;
  link: string;
  summary: string;
  published_at: null;
}

/** 抓取并解析 trending 页，产出 feed_items 行 */
export async function fetchTrendingRows(source: Source): Promise<TrendingRow[]> {
  const res = await smartFetch(source.feed_url.replace(/#.*$/, ""), 20_000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const repos = parseTrendingHtml(await res.text());
  if (repos.length === 0) throw new Error("trending 页解析出 0 个仓库 —— GitHub 页面结构可能变了");
  return repos.map((r) => ({
    source_id: source.id,
    track: source.track,
    guid: r.fullName,
    title: `GitHub 热门库：${r.fullName}`,
    link: `https://github.com/${r.fullName}`,
    // 打分模型只看 title/summary —— 把热度与语言塞进 summary 当信号
    summary: [
      `⭐ ${r.stars}${r.starsToday ? `（今日 +${r.starsToday}）` : ""}`,
      r.language,
      r.description,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 500),
    published_at: null,
  }));
}

interface TrendingRepo {
  fullName: string;
  description: string;
  language: string;
  stars: string;
  starsToday: string;
}

/** 解析 trending 页：每个仓库一个 <article class="Box-row"> 块 */
function parseTrendingHtml(html: string): TrendingRepo[] {
  const repos: TrendingRepo[] = [];
  const blocks = html.split(/<article[^>]*class="Box-row"/i).slice(1);
  for (const block of blocks) {
    // h2 里的仓库链接：<a href="/owner/repo" ...>
    const nameMatch = block.match(/<h2[^>]*>[\s\S]*?href="\/([^"\/]+\/[^"\/]+)"/i);
    if (!nameMatch) continue;
    const fullName = nameMatch[1];
    const description = strip(pickTag(block, /<p[^>]*class="col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/i));
    const language = strip(pickTag(block, /itemprop="programmingLanguage"[^>]*>([^<]+)</i));
    const stars = strip(pickTag(block, /href="\/[^"]+\/stargazers"[^>]*>([\s\S]*?)<\/a>/i));
    const starsToday = strip(pickTag(block, /([\d,]+)\s+stars?\s+today/i));
    repos.push({ fullName, description, language, stars, starsToday });
    if (repos.length >= 25) break;
  }
  return repos;
}

function pickTag(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? m[1] : "";
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ═══════════════════════════════════════════════════════════════
// 建 run 素材：仓库档案 + README
// ═══════════════════════════════════════════════════════════════

/** 是否指向单个 GitHub 仓库（排除 trending/topics 等站内页） */
export function isGitHubRepoLink(url: string): boolean {
  return parseRepoPath(url) !== null;
}

function parseRepoPath(url: string): { owner: string; repo: string } | null {
  const m = url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)\/?(?:[#?].*)?$/);
  if (!m) return null;
  const reserved = ["trending", "topics", "collections", "sponsors", "features", "orgs", "settings", "marketplace", "explore"];
  if (reserved.includes(m[1])) return null;
  return { owner: m[1], repo: m[2] };
}

interface RepoMeta {
  full_name: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  license: { spdx_id: string } | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  pushed_at: string;
}

/**
 * 抓仓库档案 + README，拼成创作底料（文本 + README 配图）。
 * 失败返回 null 由上层跳过/人工兜底。
 * 未认证 GitHub API 限流 60 次/小时/IP —— 自动产线单次只碰几个仓库，够用。
 */
export async function fetchRepoMaterial(repoUrl: string): Promise<{ text: string; images: string[] } | null> {
  const path = parseRepoPath(repoUrl);
  if (!path) return null;
  try {
    const metaRes = await smartFetch(`https://api.github.com/repos/${path.owner}/${path.repo}`, 15_000);
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as RepoMeta;

    // readme 端点自动处理默认分支与文件名大小写，content 是 base64
    let readme = "";
    let images: string[] = [];
    const readmeRes = await smartFetch(`https://api.github.com/repos/${path.owner}/${path.repo}/readme`, 15_000);
    if (readmeRes.ok) {
      const body = (await readmeRes.json()) as { content?: string };
      if (body.content) {
        const raw = Buffer.from(body.content, "base64").toString("utf8");
        images = extractReadmeImages(raw, path.owner, path.repo);
        readme = cleanReadme(raw);
      }
    }

    const lines = [
      `【仓库档案】`,
      `- 仓库：${meta.full_name}（https://github.com/${meta.full_name}）`,
      `- 简介：${meta.description ?? "（无）"}`,
      `- Stars：${meta.stargazers_count.toLocaleString()} · Forks：${meta.forks_count.toLocaleString()} · 未关闭 issue：${meta.open_issues_count}`,
      `- 主语言：${meta.language ?? "（未标注）"}${meta.topics.length > 0 ? ` · Topics：${meta.topics.slice(0, 8).join(", ")}` : ""}`,
      `- License：${meta.license?.spdx_id ?? "（未声明）"}`,
      `- 创建：${meta.created_at.slice(0, 10)} · 最近推送：${meta.pushed_at.slice(0, 10)}`,
    ];
    if (meta.homepage) lines.push(`- 官网：${meta.homepage}`);
    lines.push(``, `【README】`, readme || "（README 抓取失败或为空 —— 只依据上方档案信息创作，不要编造功能细节）");
    return { text: lines.join("\n"), images };
  } catch {
    return null;
  }
}

/** README 清洗：去 badge/图片/HTML 标签，压空行，截断防 token 爆炸 */
function cleanReadme(md: string): string {
  return md
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "") // 徽章链接 [![..](..)](..)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")               // 图片 ![..](..)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>\n]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 5000);
}

/**
 * 从 README 原文抽正文配图：markdown 图 + <img>，相对路径解析到
 * raw.githubusercontent.com，滤掉徽章/logo/svg，最多 6 张。
 */
function extractReadmeImages(md: string, owner: string, repo: string): string[] {
  const urls: string[] = [];
  const add = (src: string) => {
    if (urls.length >= 6 || !src) return;
    let abs = src.trim();
    if (!/^https?:\/\//i.test(abs)) {
      // 仓库内相对路径 → raw 直链（HEAD 指默认分支）
      abs = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${abs.replace(/^\.?\//, "")}`;
    }
    // github.com 的 blob/raw 页面链接 → raw 直链
    abs = abs.replace(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|raw)\//, "https://raw.githubusercontent.com/$1/");
    // 徽章/图标/svg 进公众号没意义（svg 微信也不支持）
    if (/shields\.io|badge|\.svg([?#]|$)|logo|icon|star-history/i.test(abs)) return;
    // 允许常规图片扩展名；GitHub 附件直链（user-attachments/assets）无扩展名但都是图/视频，一并收
    const isAttachment = /githubusercontent\.com|github\.com\/user-attachments\/assets\//i.test(abs);
    if (!/\.(jpe?g|png|webp|gif)([?#]|$)/i.test(abs) && !isAttachment) return;
    if (!urls.includes(abs)) urls.push(abs);
  };
  for (const m of md.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)/g)) add(m[1]);
  for (const m of md.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) add(m[1]);
  return urls;
}
