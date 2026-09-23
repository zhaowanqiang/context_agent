import type { Metadata } from "next";
import Link from "next/link";
import { SITE, TG_BOT, TG_GROUP_URL, X_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "关于",
  description: SITE.description,
};

const CONTACT_EMAIL = "zynqorw@gmail.com";

/** 右栏速览：都是本页正文里已有的事实，压成一屏可扫的表 */
const FACTS: [string, string][] = [
  ["身份", "全栈开发者"],
  ["在做", "出海开户决策"],
  ["在写", "跨境金融 · 加密卡 · 海外手机号"],
  ["发布", "X + Telegram 交流群"],
];

/** 找到我：两个阵地 + GitHub */
const LINKS = [
  { label: "X @zynqorw", href: X_URL },
  { label: "TG 交流群", href: TG_GROUP_URL },
  { label: "GitHub", href: "https://github.com/zhaowanqiang" },
];

/**
 * 页面底部「其他项目」一行。空数组 = 不显示。
 * 要放 contentagent 就加一条：{ label: "contentagent", href: "https://github.com/zhaowanqiang/context_agent" }
 */
const OTHER_PROJECTS: { label: string; href: string }[] = [];

const EXT_LINK =
  "text-neutral-600 underline decoration-neutral-300 underline-offset-4 transition hover:text-amber-700 hover:decoration-amber-400";

/** 公开层：关于页。纯静态内容，直接改这个文件即可。
 *  版式：正文栏定宽 42rem 保行长，右侧粘性资料栏承接剩余宽度——滚到哪儿联系方式都在视线里。 */
export default function AboutPage() {
  return (
    <div className="py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
        关于<span className="text-amber-500">.</span>
      </h1>

      <div className="mt-8 grid gap-10 border-t border-neutral-200 pt-8 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] lg:gap-14">
        <div className="md-body md-article">
          <p>
            我是 <strong>zynqorw</strong>，全栈开发者，写跨境金融方向的实测：加密支付卡、海外手机号、海外账户开户。
            亲自开户、充值、刷卡、踩坑，把流程和坑点写成教程，发在{" "}
            <a href={X_URL} target="_blank" rel="noopener noreferrer">
              X @zynqorw ↗
            </a>
            。
          </p>

          <h2>交流群</h2>
          <p>
            教程在 X 上越发越多，翻主页找帖子很费劲，所以建了一个{" "}
            <a href={TG_GROUP_URL} target="_blank" rel="noopener noreferrer">
              Telegram 交流群 ↗
            </a>
            。在群里发关键词（比如 <code>wise</code>、<code>U卡</code>），机器人 {TG_BOT}{" "}
            会直接回对应的教程链接；有具体问题也可以在群里问。
          </p>

          <h2>这个站点有什么</h2>
          <ul>
            <li>
              <strong>X 文章</strong>——我在 X 上发过的教程索引，按标签找。<Link href="/on-x">进入 →</Link>
            </li>
            <li>
              <strong>加密卡片</strong>——逐张整理门槛、充值方式、托管方式和开卡流程。<Link href="/cards">进入 →</Link>
            </li>
            <li>
              <strong>海外手机号</strong>——获取方式、保号规则、能否接收海外平台验证码。
              <Link href="/numbers">进入 →</Link>
            </li>
            <li>
              <strong>出海开户决策</strong>——答几个问题，当场给出你能开哪些账户/卡、推荐顺序与坑点，
              付费解锁保姆级实操教程。<Link href="/decider">进入 →</Link>
            </li>
          </ul>

          <h2>关于数据</h2>
          <p>
            费率、限额、保号规则这类信息变动频繁。站内没核实过的一律标「待核实」，不猜数字；
            发现写错或过时的，欢迎在群里或发邮件告诉我。
          </p>

          {OTHER_PROJECTS.length > 0 && (
            <p className="text-[13.5px] text-neutral-500">
              其他项目：
              {OTHER_PROJECTS.map((p, i) => (
                <span key={p.href}>
                  {i > 0 && " · "}
                  <a href={p.href} target="_blank" rel="noopener noreferrer">
                    {p.label} ↗
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>

        {/* 粘性资料栏：速览表 + 联系方式，跟随滚动 */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <p className="border-b border-neutral-200 bg-neutral-100/70 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              速览
            </p>
            <dl className="divide-y divide-neutral-200/70 px-4 text-[12.5px] leading-relaxed">
              {FACTS.map(([k, v]) => (
                <div key={k} className="flex gap-3 py-2.5">
                  <dt className="w-[36px] shrink-0 text-neutral-500">{k}</dt>
                  <dd className="min-w-0 text-neutral-700">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/50 p-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              找到我
            </p>
            <a
              href={TG_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block rounded-lg bg-amber-700 px-4 py-2.5 text-center text-[13.5px] font-medium text-white transition hover:bg-amber-800"
            >
              加入 TG 交流群 ↗
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-2 block rounded-lg border border-amber-300 bg-white px-4 py-2 text-center text-[13px] text-amber-800 transition hover:bg-amber-50"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="mt-2.5 text-[12px] leading-relaxed text-neutral-600">
              合作、读者反馈、纠错都可以发邮件。
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-amber-200/60 pt-3 text-[12.5px]">
              {LINKS.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={EXT_LINK}>
                  {l.label} ↗
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
