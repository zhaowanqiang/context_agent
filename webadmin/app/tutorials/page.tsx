import type { Metadata } from "next";
import TutorialsSection from "@/components/tutorials/TutorialsSection";
import { siteUrl, TG_BOT, TG_GROUP_URL, X_URL } from "@/lib/site";
import { sharedSections, visibleCategories } from "@/lib/tutorials";

export const metadata: Metadata = {
  title: "教程导航",
  description:
    "跨境金融工具教程导航：银行与账户、交易所、U 卡、海外手机号。每篇附邀请码与注册链接，完整教程在 X @zynqorw，也可以在 Telegram 交流群发关键词获取。",
  alternates: { canonical: `${siteUrl()}/tutorials` },
};

/**
 * 公开层：教程导航。全部内容来自 data/tutorials.json（经 lib/tutorials.ts 筛掉暂不上线的分类），
 * 纯静态渲染；筛选、搜索、详情展开都在浏览器里做，不向任何第三方发数据
 * （注册点击与邀请码复制只记到站内 /api/track）。
 */
export default function TutorialsPage() {
  const categories = visibleCategories();
  const total = categories.reduce((n, c) => n + c.tutorials.length, 0);

  return (
    <div className="py-8 sm:py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-strong">
        教程导航<span className="text-amber-500">.</span>
      </h1>
      <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-ink-muted">
        我在{" "}
        <a
          href={X_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-accent-line underline-offset-4 hover:text-accent-strong"
        >
          X @zynqorw ↗
        </a>{" "}
        发过的 {total} 篇教程，按类别整理。点开卡片能拿到邀请码、注册链接和 X 上的完整教程；在{" "}
        <a
          href={TG_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-accent-line underline-offset-4 hover:text-accent-strong"
        >
          Telegram 交流群 ↗
        </a>{" "}
        里发卡片上的触发词，机器人 {TG_BOT} 会直接回对应教程。
      </p>

      <TutorialsSection categories={categories} shared={sharedSections()} />

      <p className="mt-12 border-t border-line pt-5 text-[12.5px] leading-relaxed text-ink-subtle">
        部分链接为邀请链接，通过链接注册我可能获得奖励。
      </p>
    </div>
  );
}
