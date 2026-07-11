import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** 公开层收录，工作台路由明确禁爬（反正有登录墙，这里是给爬虫省力） */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/agent", "/monitor", "/login", "/api/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
