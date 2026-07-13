import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { MODULES } from "@/lib/modules";
import { listPosts, type Post } from "@/lib/posts";
import { SITE } from "@/lib/site";
import { db } from "@/lib/supabase";

// ISR：公网门面实例 60s 再验证（isAdminAuthed 在门面模式下不碰 cookie，可静态化）；
// 本机实例照旧逐请求渲染（cookie 判定登录态）
export const revalidate = 60;

/* 首页 = 纯公开个人名片（所见即访客所见）。
   工作台总览在 /dashboard，登录后这里只多一条细栏直达——
   对外门面和对内工具在页面级分离，互不挡路。 */

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

export default async function Home() {
  const authed = await isAdminAuthed();
  const [latestPosts, pending] = await Promise.all([
    listPosts(3).catch(() => [] as Post[]),
    authed ? pendingTotal() : Promise.resolve(null),
  ]);
  const decider = MODULES.find((m) => m.id === "decider")!;

  return (
    <div className="mx-auto max-w-2xl">
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

      {/* Hero：个人名片（公开）——名字用衬线展示体做记忆点 */}
      <section className="pb-12 pt-10 sm:pt-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-amber-700">
          Full-stack Developer
        </p>
        <h1 className="font-display mt-2 text-5xl font-bold tracking-tight text-neutral-900 sm:text-6xl">
          {SITE.name}
          <span className="text-amber-500">.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-[1.9] text-neutral-600">
          写跨境金融与加密支付卡实测、AI 工具与效率实测。
          所有内容出自我自己搭的 AI 产线——机器起草，事实闸门把关，
          每一篇都经人工核对后发布。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px]">
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
      </section>

      {/* 最新文章（公开）：编辑部式扁平列表——日期左栏 + 标题 + 摘要 */}
      <section className="border-t border-neutral-200 pt-8">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.15em] text-neutral-400">最新文章</h2>
          <Link href="/posts" className="text-[12.5px] text-neutral-400 transition hover:text-amber-700">
            全部文章 →
          </Link>
        </div>
        {latestPosts.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-neutral-400">第一篇文章正在产线上。</p>
        ) : (
          <ul className="divide-y divide-neutral-200/70">
            {latestPosts.map((p) => (
              <li key={p.id}>
                <Link href={`/posts/${p.slug}`} className="group grid gap-x-5 py-5 sm:grid-cols-[92px_1fr]">
                  <time className="pt-0.5 text-[12.5px] tabular-nums text-neutral-400">
                    {new Date(p.published_at).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  </time>
                  <div className="min-w-0">
                    <h3 className="text-[16.5px] font-semibold leading-snug text-neutral-900 transition group-hover:text-amber-700">
                      {p.title}
                    </h3>
                    {p.summary && (
                      <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-neutral-500">{p.summary}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 作品（公开）：付费产品 + 开源产线。
          公网门面实例在 decider 上线（配 DECIDER_URL）前不展示 decider 卡——别给访客断链 */}
      <section className="mt-12 border-t border-neutral-200 pt-8">
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.15em] text-neutral-400">作品</h2>
        <div className="divide-y divide-neutral-200/70">
          {(process.env.PUBLIC_FACADE !== "1" || process.env.DECIDER_URL) && (
            <a
              href={decider.href}
              className="group -mx-3 flex items-start gap-4 rounded-xl px-3 py-5 transition hover:bg-amber-50/60"
            >
              <span className="mt-0.5 text-[26px] leading-none" aria-hidden>
                {decider.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <h3 className="text-[16.5px] font-semibold text-neutral-900 transition group-hover:text-amber-800">
                    {decider.name}
                  </h3>
                  <span className="text-[12px] text-neutral-400 opacity-0 transition group-hover:opacity-100">试一试 ↗</span>
                </span>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500">{decider.tagline}</p>
              </span>
            </a>
          )}
          <a
            href="https://github.com/zhaowanqiang/context_agent"
            target="_blank"
            rel="noreferrer"
            className="group -mx-3 flex items-start gap-4 rounded-xl px-3 py-5 transition hover:bg-amber-50/60"
          >
            <span className="mt-0.5 text-[26px] leading-none" aria-hidden>
              ⚙️
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <h3 className="text-[16.5px] font-semibold text-neutral-900 transition group-hover:text-amber-800">
                  contentagent · AI 内容产线（开源）
                </h3>
                <span className="text-[12px] text-neutral-400 opacity-0 transition group-hover:opacity-100">GitHub ↗</span>
              </span>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500">
                驱动这个网站的系统：RSS 选题 + 情报监控 → AI 两跳成稿 → 事实闸门 → 人工把关发布，双平台产线 + 工作台
              </p>
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}
