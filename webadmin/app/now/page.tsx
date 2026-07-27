import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "此刻",
  description: "我现在在做什么——now 页，不定期更新。",
};

const REPO = "https://github.com/zhaowanqiang/context_agent";

/** 右栏工具箱：原正文末尾那段的结构化版本 */
const STACK: [string, string][] = [
  ["前端", "Next.js"],
  ["数据", "Supabase"],
  ["模型", "DeepSeek"],
  ["写作", "自建工作台"],
];

/** 公开层：/now 页（个人网站文化标配）。纯静态，直接改这个文件更新。
 *  版式与 /about 同构：正文栏定宽 42rem 保行长，右侧粘性栏放工具箱与订阅入口。 */
export default function NowPage() {
  return (
    <div className="py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
        此刻<span className="text-amber-500">.</span>
      </h1>
      <p className="mt-2 text-[12.5px] text-neutral-400">
        我现在在做什么 · 更新于 2026 年 7 月
      </p>

      <div className="mt-8 grid gap-10 border-t border-neutral-200 pt-8 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] lg:gap-14">
        <div className="md-body md-article">
          <h2>正在做</h2>
          <ul>
            <li>
              运营这个刚上线的个人网站——内容由我自己搭的 AI 产线驱动：RSS 选题 + 每日情报监控 →
              AI 起草 → 事实闸门 → 人工核对发布，公众号与 X 双轨
            </li>
            <li>
              打磨 <a href="https://decider.zynqorw.com">出海开户决策</a>——海外账户/U 卡实测教程库，
              刚完成首发定价和教程面板改版
            </li>
            <li>持续实测各家加密支付卡与跨境账户，把费率和坑写成干货</li>
          </ul>

          <h2>正在想</h2>
          <ul>
            <li>怎么让「发布效果数据」反哺选题判断——发布中心的命中率看板刚开始攒样本</li>
            <li>AI 产线的下一步：让机器处理更多机械环节，人只做判断</li>
          </ul>
        </div>

        {/* 粘性资料栏：工具箱 + 订阅，与 /about 同构 */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <p className="border-b border-neutral-200 bg-neutral-100/70 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              工具箱
            </p>
            <dl className="divide-y divide-neutral-200/70 px-4 text-[12.5px] leading-relaxed">
              {STACK.map(([k, v]) => (
                <div key={k} className="flex gap-3 py-2.5">
                  <dt className="w-[36px] shrink-0 text-neutral-400">{k}</dt>
                  <dd className="min-w-0 text-neutral-700">{v}</dd>
                </div>
              ))}
            </dl>
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="group block border-t border-neutral-200 px-4 py-2.5 text-[12.5px] text-neutral-500 transition hover:bg-neutral-50 hover:text-amber-700"
            >
              整套系统是开源的{" "}
              <span className="inline-block transition group-hover:translate-x-0.5">↗</span>
            </a>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/50 p-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700/80">
              保持更新
            </p>
            <p className="mt-2.5 text-[12px] leading-relaxed text-neutral-500">
              这页不定期更新；文章发布走 RSS 与 X。
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
              <a
                href="/rss.xml"
                className="text-neutral-500 underline decoration-neutral-300 underline-offset-4 transition hover:text-amber-700 hover:decoration-amber-400"
              >
                RSS
              </a>
              <a
                href="https://x.com/zynqorw"
                target="_blank"
                rel="noreferrer"
                className="text-neutral-500 underline decoration-neutral-300 underline-offset-4 transition hover:text-amber-700 hover:decoration-amber-400"
              >
                X @zynqorw ↗
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
