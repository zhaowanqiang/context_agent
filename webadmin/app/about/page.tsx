import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "关于",
  description: SITE.description,
};

const CONTACT_EMAIL = "zynqorw@gmail.com";

/** 右栏速览：都是本页正文里已有的事实，压成一屏可扫的表 */
const FACTS: [string, string][] = [
  ["身份", "全栈开发者"],
  ["在做", "出海开户决策 · contentagent"],
  ["在写", "跨境金融实测 · AI 工具实测"],
  ["发布", "公众号 + X 双轨"],
];

/** 公开层：关于页。纯静态内容，直接改这个文件即可。
 *  版式：正文栏定宽 42rem 保行长（长文不能靠加宽填空白），
 *  右侧粘性资料栏承接剩余宽度——滚到哪儿联系方式都在视线里。 */
export default function AboutPage() {
  return (
    <div className="py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
        关于<span className="text-amber-500">.</span>
      </h1>

      <div className="mt-8 grid gap-10 border-t border-neutral-200 pt-8 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] lg:gap-14">
        <div className="md-body md-article">
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
        </div>

        {/* 粘性资料栏：速览表 + 联系方式，跟随滚动 */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <p className="border-b border-neutral-200 bg-neutral-100/70 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              速览
            </p>
            <dl className="divide-y divide-neutral-200/70 px-4 text-[12.5px] leading-relaxed">
              {FACTS.map(([k, v]) => (
                <div key={k} className="flex gap-3 py-2.5">
                  <dt className="w-[36px] shrink-0 text-neutral-400">{k}</dt>
                  <dd className="min-w-0 text-neutral-700">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/50 p-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700/80">
              找到我
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-3 block rounded-lg bg-amber-700 px-4 py-2.5 text-center text-[13.5px] font-medium text-white transition hover:bg-amber-800"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="mt-2.5 text-[12px] leading-relaxed text-neutral-500">
              合作、读者反馈、纠错都可以发这里。
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-amber-200/60 pt-3 text-[12.5px]">
              {SITE.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-500 underline decoration-neutral-300 underline-offset-4 transition hover:text-amber-700 hover:decoration-amber-400"
                >
                  {l.label} ↗
                </a>
              ))}
              <a
                href="/rss.xml"
                className="text-neutral-500 underline decoration-neutral-300 underline-offset-4 transition hover:text-amber-700 hover:decoration-amber-400"
              >
                RSS
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
