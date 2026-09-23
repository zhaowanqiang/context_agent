import Link from "next/link";
import TgGroupSection from "@/components/TgGroupSection";
import { cards } from "@/data/crypto-cards";
import { latestXArticle, shortDate } from "@/data/x-articles";
import { isAdminAuthed } from "@/lib/adminAuth";
import { MODULES } from "@/lib/modules";
import { SITE, TG_GROUP_URL, X_URL } from "@/lib/site";
import { db } from "@/lib/supabase";

// ISR：公网门面实例 60s 再验证（isAdminAuthed 在门面模式下不碰 cookie，可静态化）；
// 本机实例照旧逐请求渲染（cookie 判定登录态）
export const revalidate = 60;

/* 首页 = 纯公开个人名片（所见即访客所见）。
   工作台总览在 /dashboard，登录后这里只多一条细栏直达——
   对外门面和对内工具在页面级分离，互不挡路。

   版式：门面从「一条 42rem 窄栏」改成「Hero/长文收窄 + 卡片区撑满 5xl 网格」，
   访客动线 = 我是谁（关注 X / 入群）→ 入群能拿到什么 → 我能帮你什么 → 我在做什么 → 怎么找我。 */

const CONTACT_EMAIL = "zynqorw@gmail.com";

/** 「我能帮你什么」三张卡：痛点 → 交付 → 证据 → 去处，四段式固定结构。
 *  去处二选一：cta + href 整卡跳转；或 links 卡内并列多个文字链接（一张卡对应多个去处时） */
type Service = {
  index: string;
  kicker: string;
  title: string;
  problem: string;
  delivery: string;
  proofLabel: string;
  proof: string;
} & (
  | {
      cta: string;
      /** http(s) 外链新窗口打开，站内路由/mailto 同窗口——渲染时按前缀判定 */
      href: string;
      links?: never;
    }
  | { links: { label: string; href: string }[]; cta?: never; href?: never }
);

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

const CARD_CLASS =
  "group flex flex-col rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-amber-300 hover:shadow-[0_1px_16px_rgba(180,83,9,0.07)]";

function ServiceCard({ s }: { s: Service }) {
  const body = (
    <>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
        {s.index} / {s.kicker}
      </p>
      <h3
        className={`mt-3 text-[16.5px] font-semibold leading-snug text-neutral-900 transition ${
          s.links ? "" : "group-hover:text-amber-800"
        }`}
      >
        {s.title}
      </h3>

      <dl className="mt-4 flex-1 space-y-3 text-[13.5px] leading-relaxed">
        <div>
          <dt className="text-[12px] font-medium text-neutral-500">你可能正在</dt>
          <dd className="mt-0.5 text-neutral-600">{s.problem}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-medium text-neutral-500">我可以帮你</dt>
          <dd className="mt-0.5 text-neutral-600">{s.delivery}</dd>
        </div>
      </dl>
    </>
  );
  const proof = (
    <p className="text-[12px] text-neutral-500">
      {s.proofLabel} · <span className="text-neutral-600">{s.proof}</span>
    </p>
  );

  if (s.links) {
    return (
      <div className={CARD_CLASS.replace("group ", "")}>
        {body}
        <div className="mt-4 border-t border-neutral-200/80 pt-3">
          {proof}
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] font-medium">
            {s.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-amber-700 underline-offset-4 transition hover:text-amber-800 hover:underline"
              >
                {l.label} →
              </Link>
            ))}
          </p>
        </div>
      </div>
    );
  }

  return (
    <a href={s.href} {...(s.href.startsWith("http") ? EXTERNAL : {})} className={CARD_CLASS}>
      {body}
      <div className="mt-4 border-t border-neutral-200/80 pt-3">
        {proof}
        <p className="mt-2 text-[13.5px] font-medium text-amber-700">
          {s.cta} <span className="inline-block transition group-hover:translate-x-0.5">→</span>
        </p>
      </div>
    </a>
  );
}

const SERVICES: Service[] = [
  {
    index: "01",
    kicker: "PRODUCT",
    title: "搞清楚自己能开哪些海外账户",
    problem: "想开海外账户或 U 卡，但不知道自己这个身份能开哪些、该先开哪个、哪一步会被拒。",
    delivery: "答几个问题，当场给出可开清单、推荐顺序和坑点；教程库里是我逐张卡实测出来的保姆级流程。",
    proofLabel: "已有实践",
    proof: "出海开户决策 · 2 篇教程全文免费",
    cta: "开始测一测",
    href: "/decider",
  },
  {
    index: "02",
    kicker: "TOOLKIT",
    title: "拿到一张能用的加密卡 / 海外手机号",
    problem: "想订阅海外服务、注册海外平台，却卡在没有能用的卡、收不到验证码这一步。",
    delivery:
      "加密卡片按门槛、充值方式、托管方式逐张整理；海外手机号按获取方式、保号规则、能否接码整理——没核实过的一律标「待核实」。",
    proofLabel: "收录中",
    proof: `加密卡片 ${cards.length} 张 · 海外手机号整理中`,
    links: [
      { label: "看加密卡片", href: "/cards" },
      { label: "看海外手机号", href: "/numbers" },
    ],
  },
  {
    index: "03",
    kicker: "COLLABORATION",
    title: "把一个想法做成能用的第一版",
    problem: "有明确场景和目标，但缺一个能从头把它做出来、并且真的上线的人。",
    delivery: "全栈开发（Next.js + Supabase + LLM），偏跨境支付、AI 工作流和内容系统方向；也接实测向的咨询。",
    proofLabel: "自证",
    proof: "本站与出海开户决策均为独立开发上线",
    cta: "说说你的问题",
    href: `mailto:${CONTACT_EMAIL}`,
  },
];

/** 产品矩阵：不包装成成熟商业项目，公开真实状态 */
interface Product {
  emoji: string;
  name: string;
  slogan: string;
  status: string;
  /** 状态徽章：第一枚用琥珀实心表示「已上线/运行中」 */
  badges: string[];
  cta: string;
  href: string;
}

/** decider 的 href 走门户跳转路由，从注册表取，别在两处各写一份 */
const DECIDER = MODULES.find((m) => m.id === "decider")!;

const PRODUCTS: Product[] = [
  {
    emoji: DECIDER.emoji,
    name: DECIDER.name,
    slogan: "不确定能开哪个？先测，再动手。",
    status: "教程库已上线，2 篇全文免费；决策器按身份与需求给个性化开户顺序。刚完成首发定价与教程面板改版。",
    badges: ["已上线", "Web", "付费解锁"],
    cta: "打开",
    href: DECIDER.href,
  },
];

/** 登录后细栏上的待办合计（查不到时静默降级为纯入口） */
async function pendingTotal(): Promise<number | null> {
  try {
    const { count } = await db()
      .from("runs")
      .select("*", { count: "exact", head: true })
      .in("status", ["outline_review", "draft_review", "failed"]);
    return count ?? 0;
  } catch {
    return null;
  }
}

/** 区块小标题：等宽大写字母 + 字距，全站统一 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.18em] text-amber-700">
      {children}
    </p>
  );
}

export default async function Home() {
  const authed = await isAdminAuthed();
  const pending = authed ? await pendingTotal() : null;

  // 最近一次发布：取 X 文章索引里日期最新的一条，不硬编码
  const lastShip = latestXArticle();

  return (
    /* 首页不自设宽度，撑满 layout 给的容器（访客 1024 / 登录 1480），
       右边缘始终与导航齐平。每个区块都按容器宽度自适应填充，
       所以两种宽度下都是满的——「所见即访客所见」靠版式一致保证，不靠锁死像素 */
    <div>
      {/* 工作台细栏（仅登录后）：不打断名片版式，一行直达 */}
      {authed && (
        <Link
          href="/dashboard"
          className="group mt-4 flex items-center justify-between rounded-lg border border-amber-200/70 bg-amber-50/60 px-4 py-2.5 text-[13px] transition hover:border-amber-300 hover:bg-amber-50"
        >
          <span className="text-neutral-600">
            ⚡ 工作台
            {pending !== null && pending > 0 && (
              <>
                {" · "}
                <b className="text-amber-700">{pending} 项等你处理</b>
              </>
            )}
            {pending === 0 && " · 全部处理完毕"}
          </span>
          <span className="font-medium text-amber-700">进入 →</span>
        </Link>
      )}

      {/* Hero：个人名片（公开）——左侧名字用衬线展示体做记忆点，
          右侧终端名片把「我是干什么的」压成一屏可扫的事实表，顺带填掉右上角留白 */}
      <section className="grid gap-10 pb-14 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] lg:items-center lg:gap-14">
        <div>
          <p className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Cross-border Fintech · On X
          </p>
          <h1 className="font-display mt-2 text-5xl font-bold tracking-tight text-neutral-900 sm:text-6xl">
            {SITE.name}
            <span className="text-amber-500">.</span>
          </h1>
          <p className="mt-5 text-[16px] leading-[1.9] text-neutral-600">
            写跨境金融、加密支付卡、海外手机号的实测教程，都发在 X 上。
            加入 Telegram 交流群，发一个关键词，机器人直接回你对应的教程。
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 text-[14px]">
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-amber-700 px-5 py-2.5 font-medium text-white transition hover:bg-amber-800"
            >
              关注 X @zynqorw ↗
            </a>
            <a
              href={TG_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-amber-300 bg-white px-5 py-2.5 font-medium text-amber-800 transition hover:border-amber-400 hover:bg-amber-50"
            >
              加入 TG 交流群 ↗
            </a>
          </div>
          <p className="mt-4 text-[13.5px]">
            <a
              href="https://github.com/zhaowanqiang"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 underline decoration-neutral-300 underline-offset-4 transition hover:text-amber-700 hover:decoration-amber-400"
            >
              GitHub ↗
            </a>
          </p>
        </div>

        {/* 终端名片：等宽排版的事实表，内容全部可在站内验证，不写自我评价 */}
        <aside className="@container overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_16px_rgba(28,25,23,0.04)]">
          <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-100/70 px-4 py-2.5">
            <span className="flex gap-1.5" aria-hidden>
              <span className="size-2 rounded-full bg-neutral-300" />
              <span className="size-2 rounded-full bg-neutral-300" />
              <span className="size-2 rounded-full bg-neutral-300" />
            </span>
            <span className="font-mono text-[11.5px] text-neutral-500">~/{SITE.name}</span>
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-neutral-500">
              <span className="size-1.5 rounded-full bg-amber-500 motion-safe:animate-pulse" aria-hidden />
              live
            </span>
          </div>

          {/* 卡片自身宽度决定排布（容器查询，不看视口）：窄容器 4 行，
              宽容器 2×2——同一张卡在 1024 和 1480 两种版心里都不留空 */}
          <dl className="grid gap-px bg-neutral-200/70 text-[12.5px] leading-relaxed @md:grid-cols-2">
            {[
              ["product", "出海开户决策"],
              ["writing", "跨境金融实测 · 加密卡 · 海外手机号"],
              ["stack", "Next.js · Supabase"],
              ["channel", "X + Telegram 交流群"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 bg-white px-4 py-2.5">
                <dt className="w-[54px] shrink-0 font-mono text-[11px] text-neutral-500">{k}</dt>
                <dd className="min-w-0 text-neutral-700">{v}</dd>
              </div>
            ))}
          </dl>

          {/* 最近一次发布：data/x-articles.ts 里日期最新的一条，外链到 X 原帖 */}
          {lastShip && (
            <a
              href={lastShip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block border-t border-neutral-200 bg-amber-50/40 px-4 py-3 transition hover:bg-amber-50"
            >
              <p className="font-mono text-[10.5px] uppercase tracking-wider text-neutral-500">
                last ship ·{" "}
                <time dateTime={lastShip.date} className="tabular-nums">
                  {shortDate(lastShip.date)}
                </time>
                {" · on X ↗"}
              </p>
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-neutral-700 transition group-hover:text-amber-800">
                {lastShip.title}
              </p>
            </a>
          )}
        </aside>
      </section>

      {/* 交流群：网站的第二个转化目标（第一个是 Hero 里的关注 X）。
          紧跟 Hero，让「入群能拿到什么」在第一屏之后立刻出现 */}
      <TgGroupSection />

      {/* P0-1 我能帮你什么：访客动线的第一个转化环节。
          每张卡固定四段式——痛点说访客的话，交付说清给什么，证据指向真实产品，最后给去处 */}
      <section className="mt-16 border-t border-neutral-200 pt-10">
        <SectionLabel>How I can help</SectionLabel>
        <h2 className="font-display mt-2 max-w-2xl text-[26px] font-bold leading-snug tracking-tight text-neutral-900 sm:text-3xl">
          有具体问题，我帮你推进到能用的结果。
        </h2>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-neutral-500">
          下面三件事我都在自己身上跑过一遍——先说你卡在哪，再判断合不合适。
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <ServiceCard key={s.index} s={s} />
          ))}
        </div>
      </section>

      {/* P0-2 产品矩阵：状态徽章 + 一句主张 + 一句真实现状，取代原先只有一行 tagline 的作品列表 */}
      <section className="mt-16 border-t border-neutral-200 pt-10">
        <SectionLabel>Current products</SectionLabel>
        <h2 className="font-display mt-2 text-[26px] font-bold leading-snug tracking-tight text-neutral-900 sm:text-3xl">
          正在推进的产品。
        </h2>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-neutral-500">
          不包装成已经成熟的商业项目，公开真实状态。
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PRODUCTS.map((p) => (
            <a
              key={p.name}
              href={p.href}
              {...(p.href.startsWith("http") ? EXTERNAL : {})}
              className="group flex flex-col rounded-xl border border-neutral-200 bg-white p-6 transition hover:border-amber-300 hover:shadow-[0_1px_16px_rgba(180,83,9,0.07)]"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {p.badges.map((b, i) => (
                  <span
                    key={b}
                    className={
                      i === 0
                        ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-[11.5px] font-medium text-amber-800"
                        : "rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11.5px] text-neutral-500"
                    }
                  >
                    {b}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-start gap-3">
                <span className="text-[26px] leading-none" aria-hidden>
                  {p.emoji}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-semibold leading-snug text-neutral-900 transition group-hover:text-amber-800">
                    {p.name}
                  </h3>
                  <p className="mt-1 text-[13.5px] text-neutral-500">{p.slogan}</p>
                </div>
              </div>

              <p className="mt-4 flex-1 text-[13.5px] leading-relaxed text-neutral-600">{p.status}</p>

              <p className="mt-4 text-[13.5px] font-medium text-amber-700">
                {p.cta} <span className="inline-block transition group-hover:translate-x-0.5">↗</span>
              </p>
            </a>
          ))}
        </div>
      </section>

      {/* P0-3 合作区：动线终点。邮箱从 /about 末行提到首页，给一个明确的下一步 */}
      <section className="mt-16">
        {/* 左文右动作两栏：容器变宽时右栏承接留白，不让 CTA 吊在左下角 */}
        <div className="grid gap-8 rounded-2xl border border-amber-200/70 bg-amber-50/50 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-center lg:gap-14">
          <div>
            <SectionLabel>Work with me</SectionLabel>
            <h2 className="font-display mt-2 text-[26px] font-bold leading-snug tracking-tight text-neutral-900 sm:text-3xl">
              有具体问题、目标和预算，我们可以聊聊。
            </h2>
            <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-neutral-600">
              目前开放全栈产品开发、AI 内容工作流搭建，以及跨境支付与开户方向的实测咨询；
              也接受相关工具与产品的实测合作。
            </p>
          </div>

          <div className="lg:justify-self-end lg:text-right">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-block rounded-lg bg-amber-700 px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-amber-800"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="mt-3">
              <a
                href="https://x.com/zynqorw"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13.5px] text-neutral-500 underline decoration-neutral-300 underline-offset-4 transition hover:text-amber-700 hover:decoration-amber-400"
              >
                或在 X 上找我 ↗
              </a>
            </p>
            <p className="mt-4 text-[12.5px] leading-relaxed text-neutral-500">
              来信请写清楚：你在做什么、卡在哪里、希望得到什么结果。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
