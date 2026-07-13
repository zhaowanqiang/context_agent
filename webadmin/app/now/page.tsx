import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "此刻",
  description: "我现在在做什么——now 页，不定期更新。",
};

/** 公开层：/now 页（个人网站文化标配）。纯静态，直接改这个文件更新。 */
export default function NowPage() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
        此刻<span className="text-amber-500">.</span>
      </h1>
      <p className="mt-2 text-[12.5px] text-neutral-400">
        我现在在做什么 · 更新于 2026 年 7 月
      </p>

      <div className="md-body md-article mt-8 border-t border-neutral-200 pt-8">
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
          <li>怎么让"发布效果数据"反哺选题判断——发布中心的命中率看板刚开始攒样本</li>
          <li>AI 产线的下一步：让机器处理更多机械环节，人只做判断</li>
        </ul>

        <h2>工具箱</h2>
        <p>
          Next.js + Supabase + DeepSeek 驱动整套系统；写作在自建工作台里完成；
          这个站本身就是 <a href="https://github.com/zhaowanqiang/context_agent">开源的</a>。
        </p>
      </div>
    </div>
  );
}
