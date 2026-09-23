/**
 * X 文章索引 —— /on-x 页与首页「LAST SHIP」的唯一数据来源。
 *
 * 本站不托管正文：每条只是一个指向 X 原帖的索引项。
 * 数据全部手动维护，**不调用 X API、不爬取 X**。
 *
 * 加一篇 = 在 xArticles 里加一条。首页 LAST SHIP 自动取 date 最新的那条，
 * 不需要改任何组件。
 *
 * 本文件会被客户端组件 import（/on-x 的标签筛选），只放公开信息。
 */

export type XArticleTag = "crypto-card" | "phone" | "account" | "tools";

/** 标签：/on-x 的筛选条按这里的顺序渲染，id 同时是 URL hash（/on-x#phone） */
export const X_ARTICLE_TAGS: { id: XArticleTag; label: string }[] = [
  { id: "crypto-card", label: "加密卡" },
  { id: "phone", label: "海外手机号" },
  { id: "account", label: "开户" },
  { id: "tools", label: "工具" },
];

export interface XArticle {
  /** 稳定标识（React key 用），建议与 X 帖子 id 或内容主题对应 */
  id: string;
  title: string;
  /** X 原帖链接 */
  url: string;
  /** 发布日期 YYYY-MM-DD */
  date: string;
  tags: XArticleTag[];
  /** 一句话摘要 */
  summary: string;
  /** 交流群机器人关键词：有值时显示「群里发 xxx 获取」 */
  tgKeyword?: string;
}

export const xArticles: XArticle[] = [
  // SAMPLE — 待替换：标题、链接、日期、摘要都是占位，换成真实 X 帖子后删掉这行注释
  {
    id: "sample-1",
    title: "【示例】加密卡开卡实测：替换成你的真实 X 帖子标题",
    url: "https://x.com/zynqorw",
    date: "2026-09-01",
    tags: ["crypto-card"],
    summary: "PLACEHOLDER：一句话说明这篇帖子解决什么问题。",
    tgKeyword: "U卡",
  },
  // SAMPLE — 待替换
  {
    id: "sample-2",
    title: "【示例】海外账户开户实测：替换成你的真实 X 帖子标题",
    url: "https://x.com/zynqorw",
    date: "2026-08-15",
    tags: ["account"],
    summary: "PLACEHOLDER：一句话说明这篇帖子解决什么问题。",
    tgKeyword: "wise",
  },
];

/** 日期最新的一条（首页 LAST SHIP）。YYYY-MM-DD 可以直接按字符串比较 */
export function latestXArticle(): XArticle | undefined {
  return xArticles.reduce<XArticle | undefined>(
    (best, a) => (best === undefined || a.date > best.date ? a : best),
    undefined
  );
}

/** "2026-09-01" → "09/01"。直接切字符串，不经 Date——避免时区把日期推前一天 */
export function shortDate(date: string): string {
  return date.slice(5).replace("-", "/");
}
