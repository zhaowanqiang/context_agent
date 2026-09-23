import type { Metadata } from "next";
import XArticleList from "@/components/x-articles/XArticleList";
import { xArticles } from "@/data/x-articles";
import { siteUrl, TG_GROUP_URL, X_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "X 文章",
  description: "我发在 X 上的跨境金融、加密卡、海外手机号实测教程索引——正文都在 X，这里按标签找。",
  alternates: { canonical: `${siteUrl()}/on-x` },
};

/**
 * 公开层：X 文章索引。纯索引页，不托管正文——每条外链到 X 原帖。
 * 数据来自 data/x-articles.ts（手动维护，不调 X API、不爬取）。
 */
export default function OnXPage() {
  const articles = [...xArticles].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="mx-auto max-w-3xl py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
        X 文章<span className="text-amber-500">.</span>
      </h1>
      <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-neutral-600">
        我的实测教程都发在{" "}
        <a
          href={X_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-700 underline decoration-amber-300 underline-offset-4 hover:text-amber-800"
        >
          X @zynqorw ↗
        </a>
        ，这里是索引。带「群里发」标记的，在{" "}
        <a
          href={TG_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-700 underline decoration-amber-300 underline-offset-4 hover:text-amber-800"
        >
          TG 交流群 ↗
        </a>{" "}
        里发对应关键词，机器人会直接回链接。
      </p>

      {articles.length === 0 ? (
        <p className="mt-16 text-center text-[13.5px] text-neutral-500">索引整理中。</p>
      ) : (
        <XArticleList articles={articles} />
      )}
    </div>
  );
}
