import { listPosts } from "@/lib/posts";
import { SITE, siteUrl } from "@/lib/site";

export const revalidate = 300; // RSS 5 分钟再验证够用（阅读器本来就按小时拉）

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 公开层 RSS 输出（这条产线消费 RSS 起家，自己当然也要产 RSS） */
export async function GET() {
  const base = siteUrl();
  const posts = await listPosts(30).catch(() => []);

  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${base}/posts/${p.slug}</link>
      <guid isPermaLink="true">${base}/posts/${p.slug}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      ${p.summary ? `<description>${esc(p.summary)}</description>` : ""}
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE.name)}</title>
    <link>${base}</link>
    <description>${esc(SITE.description)}</description>
    <language>zh-cn</language>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
