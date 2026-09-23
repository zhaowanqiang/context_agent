import type { MetadataRoute } from "next";
import { guides as deciderGuides } from "@/data/decider/guides";
import { listGuides } from "@/lib/guides";
import { listPosts } from "@/lib/posts";
import { siteUrl } from "@/lib/site";

export const revalidate = 300;

/** 公开层 sitemap：固定页 + 全部文章 + decider 教程（posts 表未建时只出静态部分）。
 *  decider 教程是静态 Record，不依赖 Supabase——库不可达也照样进索引。
 *  /decider/guides 是 redirect 到 /decider 的兼容路由，不收进 sitemap。 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [posts, siteGuides] = await Promise.all([
    listPosts(1000).catch(() => []),
    listGuides(1000).catch(() => []),
  ]);
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/posts`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/decider`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/cards`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/deals`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    ...posts.map((p) => ({
      url: `${base}/posts/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // 站内免费教程：常青内容，新鲜度用核对时间
    ...siteGuides.map((g) => ({
      url: `${base}/guides/${g.slug}`,
      lastModified: new Date(g.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // decider 教程页：付费墙上方的免费部分（简介/目录/免费步骤）本就对爬虫可见
    ...Object.values(deciderGuides).map((g) => ({
      url: `${base}/decider/guide/${g.id}`,
      // verified_at 是 YYYY-MM，补 01 号当作最后更新——教程的"新鲜度"就是核对时间
      lastModified: new Date(`${g.verified_at}-01`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
