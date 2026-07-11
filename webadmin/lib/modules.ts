/** 站点功能模块注册表：首页从这里渲染模块卡片。
 *  以后加新功能 = 在 app/ 下建路由 + 这里加一条注册，首页自动出现入口。 */
export interface SiteModule {
  id: string;
  name: string;
  tagline: string;
  href: string;
  emoji: string;
  status: "active" | "planned";
  /** true = 跳出本应用（重定向路由/外链），导航用 <a> 整页跳转而非客户端路由 */
  external?: boolean;
}

export const MODULES: SiteModule[] = [
  {
    id: "contentagent",
    name: "内容 Agent",
    tagline: "RSS 选题 → AI 两跳成稿 → 事实闸门 → 人工把关发布，公众号 + X 双轨产线",
    href: "/agent/wechat",
    emoji: "✍️",
    status: "active",
  },
  {
    id: "monitor",
    name: "监控简报",
    tagline: "每日自动检索监控话题 24 小时新动态 → AI 筛选成简报，附公众号 / X 选题标注",
    href: "/monitor",
    emoji: "📡",
    status: "active",
  },
  {
    id: "decider",
    name: "出海开户决策",
    tagline: "答几个问题 → 当场给出你能开哪些账户/卡、推荐顺序与坑点，付费解锁保姆级实操教程",
    href: "/decider", // 门户跳转路由 → 独立应用（本地 3100 / 部署后 DECIDER_URL）
    emoji: "🧭",
    status: "active",
    external: true,
  },
  // 未来模块示例：
  // { id: "bookmarks", name: "稍后读", tagline: "…", href: "/bookmarks", emoji: "🔖", status: "planned" },
];
