/** 个人网站公开层的站点常量：metadata / sitemap / 首页 / 页脚共用一份。 */

/** 两个阵地：教程与实测发在 X，交流群里发关键词由机器人回教程链接 */
export const X_URL = "https://x.com/zynqorw";
export const TG_GROUP_URL = "https://t.me/x_zynqorw";
export const TG_BOT = "@zynqorw_bot";

export const SITE = {
  name: "zynqorw",
  author: "zynqorw",
  description:
    "zynqorw：跨境金融、加密支付卡、海外手机号的实测教程，发在 X @zynqorw；加入 Telegram 交流群，发关键词直接拿教程。",
  links: [
    { label: "GitHub", href: "https://github.com/zhaowanqiang" },
    { label: "X @zynqorw", href: X_URL },
  ],
} as const;

/** 部署公网后在 .env.local 设 SITE_URL（如 https://zynqorw.com）；本地缺省 localhost */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
