/** 个人网站公开层的站点常量：metadata / RSS / sitemap 共用一份。 */

export const SITE = {
  name: "zynqorw",
  author: "zynqorw",
  description: "全栈开发者 zynqorw：跨境金融与加密支付卡实测、AI 工具与效率实测，附个人工作台。",
  links: [
    { label: "GitHub", href: "https://github.com/zhaowanqiang" },
    { label: "X @zynqorw", href: "https://x.com/zynqorw" },
  ],
} as const;

/** 部署公网后在 .env.local 设 SITE_URL（如 https://zynqorw.com）；本地缺省 localhost */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
