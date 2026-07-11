import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "关于",
  description: SITE.description,
};

/** 公开层：关于页。纯静态内容，直接改这个文件即可。 */
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
        关于<span className="text-amber-500">.</span>
      </h1>

      <div className="md-body md-article mt-8 border-t border-neutral-200 pt-8">
        <p>
          我是 <strong>zynqorw</strong>，全栈开发者。这个站点由两部分组成：对外的内容存档，
          和一套只有我自己能进的 AI 工作台——文章就是从那条产线上下来的。
        </p>

        <h2>我在写什么</h2>
        <ul>
          <li>
            <strong>跨境金融 / 加密支付卡实测</strong>——亲自开户、充值、刷卡、踩坑，
            把费率和坑点写成干货帖，发在{" "}
            <a href="https://x.com/zynqorw" target="_blank" rel="noreferrer">
              X @zynqorw
            </a>
            。
          </li>
          <li>
            <strong>AI 工具与效率实测</strong>——工具怎么用、值不值得用，写成长文发在公众号。
          </li>
        </ul>
        <p>所有内容基于实测，AI 参与起草，但每一篇都经过人工核对事实清单后才发布。</p>

        <h2>我在做什么</h2>
        <ul>
          <li>
            <strong>出海开户决策</strong>——答几个问题，当场给出你能开哪些账户/卡、推荐顺序与坑点，
            付费解锁保姆级实操教程。<a href="/decider">进入 →</a>
          </li>
          <li>
            <strong>内容产线</strong>——RSS 选题 → AI 两跳成稿 → 事实闸门 → 人工把关发布的
            双轨内容生产系统，也就是驱动这个站点的东西。
          </li>
        </ul>

        <h2>找到我</h2>
        <ul>
          {SITE.links.map((l) => (
            <li key={l.href}>
              <a href={l.href} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
