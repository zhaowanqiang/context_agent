import type { MetadataRoute } from "next";
import { xArticles } from "@/data/x-articles";
import { listGuides } from "@/lib/guides";
import { listPosts } from "@/lib/posts";
import { siteUrl } from "@/lib/site";

export const revalidate = 300;

/** 公开层 sitemap：固定页 + 全部文章 + 站内教程（posts / guides 表未建时只出静态部分） */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [posts, siteGuides] = await Promise.all([
    listPosts(1000).catch(() => []),
    listGuides(1000).catch(() => []),
  ]);
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/tutorials`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/posts`, changeFrequency: "daily", priority: 0.9 },
    ...(xArticles.length > 0
      ? [{ url: `${base}/on-x`, changeFrequency: "weekly" as const, priority: 0.9 }]
      : []),
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
  ];
}
