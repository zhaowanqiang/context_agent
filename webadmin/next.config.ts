import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 页面全是 force-dynamic（每次导航都等 Supabase 云端往返）。
    // 给客户端路由缓存 30s：30 秒内在导航间来回切换秒开；
    // 变更操作后各组件显式 router.refresh()（Next 16 action 自动刷新偶发不生效），数据不会脏。
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
