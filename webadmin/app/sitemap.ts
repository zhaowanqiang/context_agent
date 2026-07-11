import type { MetadataRoute } from "next";
import { listPosts } from "@/lib/posts";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** 公开层 sitemap：固定页 + 全部文章（posts 表未建时只出固定页） */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const posts = await listPosts(1000).catch(() => []);
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/posts`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    ...posts.map((p) => ({
      url: `${base}/posts/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
