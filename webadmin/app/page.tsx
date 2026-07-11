import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { MODULES } from "@/lib/modules";
import { listPosts, type Post } from "@/lib/posts";
import { SITE } from "@/lib/site";
import { db } from "@/lib/supabase";
import { TRACK_LABEL, TRACKS, type TrackId } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TrackStat {
  pending: number;
  published: number;
}

/** 内容 Agent 模块卡上的活性指标：按轨道分列（查不到时静默降级为纯入口） */
async function agentStats(): Promise<Record<TrackId, TrackStat> | null> {
  try {
    const counts = await Promise.all(
      TRACKS.flatMap((t) => [
        db().from("runs").select("*", { count: "exact", head: true })
          .eq("track", t).in("status", ["outline_review", "draft_review", "failed"]),
        db().from("runs").select("*", { count: "exact", head: true })
          .eq("track", t).eq("status", "published"),
      ])
    );
    const out = {} as Record<TrackId, TrackStat>;
    TRACKS.forEach((t, i) => {
      out[t] = { pending: counts[i * 2].count ?? 0, published: counts[i * 2 + 1].count ?? 0 };
    });
    return out;
  } catch {
    return null;
  }
}

interface MonitorStat {
  latestTitle: string | null;
  latestAt: string | null;
  topicCount: number;
}

/** 监控简报模块卡上的活性指标（表还没建时静默降级为纯入口） */
async function monitorStats(): Promise<MonitorStat | null> {
  try {
    const [latest, topics] = await Promise.all([
      db().from("briefings").select("title, created_at")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db().from("monitor_topics").select("*", { count: "exact", head: true }).eq("enabled", true),
    ]);
    if (latest.error || topics.error) return null;
    return {
      latestTitle: latest.data?.title ?? null,
      latestAt: latest.data?.created_at ?? null,
      topicCount: topics.count ?? 0,
    };
  } catch {
    return null;
  }
}

const TRACK_ACCENT: Record<TrackId, string> = {
  wechat: "border-green-200 hover:border-green-400 hover:bg-green-50/50",
  x: "border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50",
};

export default async function Home() {
  // 公开层数据 + 登录态；工作台指标只在登录后才查
  const [authed, latestPosts] = await Promise.all([
    isAdminAuthed(),
    listPosts(3).catch(() => [] as Post[]),
  ]);
  const [stats, monitor] = authed
    ? await Promise.all([agentStats(), monitorStats()])
    : [null, null];
  const agent = MODULES.find((m) => m.id === "contentagent")!;
  const monitorModule = MODULES.find((m) => m.id === "monitor")!;
  const decider = MODULES.find((m) => m.id === "decider")!;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Hero：个人名片（公开）——名字用衬线展示体做记忆点 */}
      <section className="pb-12 pt-10 sm:pt-16">
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

      {/* 作品（公开）：对外的付费产品 */}
      <section className="mt-12 border-t border-neutral-200 pt-8">
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.15em] text-neutral-400">作品</h2>
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
      </section>

      {/* 工作台（私有）：登录后才渲染，访客不知道它存在 */}
      {authed && (
        <section className="mt-10 border-t border-neutral-200 pt-8">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">工作台</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 内容 Agent：双轨各自直达（轨道页内可随时互切） */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-xl">
                  {agent.emoji}
                </span>
                <div>
                  <h3 className="font-bold text-neutral-900">{agent.name}</h3>
                  <span className="text-[11px] text-green-600">● 运行中</span>
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">{agent.tagline}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4">
                {TRACKS.map((t) => (
                  <Link
                    key={t}
                    href={`/agent/${t}`}
                    className={`group rounded-lg border bg-white px-3.5 py-3 transition ${TRACK_ACCENT[t]}`}
                  >
                    <span className="flex items-baseline justify-between">
                      <span className="text-sm font-bold text-neutral-900">{TRACK_LABEL[t]}</span>
                      <span className="text-xs font-medium text-amber-600 opacity-0 transition group-hover:opacity-100">→</span>
                    </span>
                    {stats && (
                      <span className="mt-1.5 block text-[11px] text-neutral-400">
                        待处理{" "}
                        <b className={stats[t].pending > 0 ? "text-amber-600" : "text-neutral-600"}>
                          {stats[t].pending}
                        </b>
                        {" · "}已发布 <b className="text-neutral-600">{stats[t].published}</b>
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            {/* 监控简报：Cowork 每日回传 */}
            <Link
              href={monitorModule.href}
              className="group rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-xl">
                  {monitorModule.emoji}
                </span>
                <div>
                  <h3 className="font-bold text-neutral-900">{monitorModule.name}</h3>
                  <span className="text-[11px] text-green-600">● 运行中</span>
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">{monitorModule.tagline}</p>
              {monitor && (
                <p className="mt-4 border-t border-neutral-100 pt-4 text-[11px] text-neutral-400">
                  监控话题 <b className="text-neutral-600">{monitor.topicCount}</b>
                  {monitor.latestAt ? (
                    <>
                      {" · "}最新一期{" "}
                      <b className="text-neutral-600">
                        {new Date(monitor.latestAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </b>
                    </>
                  ) : (
                    <>{" · "}等待第一期简报</>
                  )}
                </p>
              )}
            </Link>

            {/* 扩展占位：下一个模块 */}
            <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 p-5 text-center">
              <span className="text-xl text-neutral-300">＋</span>
              <p className="mt-2 text-[13px] text-neutral-400">下一个模块</p>
              <p className="mt-1 text-[11px] text-neutral-300">在 lib/modules.ts 注册即可上首页</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
