import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // contentagent 从根路径迁到 /agent 模块命名空间，旧书签 301 过来
    return [
      { source: "/wechat", destination: "/agent/wechat", permanent: true },
      { source: "/wechat/:path*", destination: "/agent/wechat/:path*", permanent: true },
      { source: "/x", destination: "/agent/x", permanent: true },
      { source: "/x/:path*", destination: "/agent/x/:path*", permanent: true },
      // 2026-09 改版：「教程」「此刻」下线。/guides 的基础设施（表、编辑器、详情页）保留，
      // 列表页入口指到教程导航
      { source: "/guides", destination: "/tutorials", statusCode: 301 },
      // 2026-10：「出海开户决策」模块下线（答题推荐 + 教程库 + 付费墙）。
      // 旧链接在 X 和搜索结果里还活着，统一接到教程导航，不留 404
      { source: "/decider", destination: "/tutorials", statusCode: 301 },
      { source: "/decider/:path*", destination: "/tutorials", statusCode: 301 },
      { source: "/now", destination: "/about", statusCode: 301 },
      // 2026-10：海外手机号并入教程导航（数据只在 data/tutorials.json 维护一份）
      { source: "/numbers", destination: "/tutorials#phone-number", statusCode: 301 },
    ];
  },
  experimental: {
    // 页面全是 force-dynamic（每次导航都等 Supabase 云端往返）。
    // 给客户端路由缓存 30s：30 秒内在导航间来回切换秒开；
    // 变更操作后各组件显式 router.refresh()（Next 16 action 自动刷新偶发不生效），数据不会脏。
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
