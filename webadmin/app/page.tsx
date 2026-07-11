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
    <div className="mx-auto max-w-3xl">
      {/* Hero：个人名片（公开） */}
      <section className="pb-10 pt-8 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{SITE.name}</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-500">
          全栈开发者。写跨境金融与加密支付卡实测、AI 工具与效率实测——
          所有内容出自我自己搭的 AI 产线，每一篇都经人工核对后发布。
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {SITE.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-neutral-200 bg-white px-3.5 py-1 text-[13px] text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
            >
              {l.label} ↗
            </a>
          ))}
          <a
            href="/rss.xml"
            className="rounded-full border border-neutral-200 bg-white px-3.5 py-1 text-[13px] text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900"
          >
            RSS
          </a>
        </div>
      </section>

      {/* 最新文章（公开）：产线成稿回流的公开存档 */}
      <section className="border-t border-neutral-200 pt-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">最新文章</h2>
          <Link href="/posts" className="text-[12px] text-neutral-400 transition hover:text-amber-700">
            全部 →
          </Link>
        </div>
        {latestPosts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-[13px] text-neutral-400">
            第一篇文章正在产线上。
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white px-5 shadow-sm">
            {latestPosts.map((p) => (
              <li key={p.id}>
                <Link href={`/posts/${p.slug}`} className="group block py-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-neutral-800 transition group-hover:text-amber-700">
                      {p.title}
                    </span>
                    <time className="shrink-0 text-[12px] text-neutral-400">
                      {new Date(p.published_at).toLocaleDateString("zh-CN")}
                    </time>
                  </div>
                  {p.summary && (
                    <p className="mt-1 line-clamp-1 text-[12.5px] text-neutral-400">{p.summary}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 作品（公开）：对外的付费产品 */}
      <section className="mt-10 border-t border-neutral-200 pt-8">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">作品</h2>
        <a
          href={decider.href}
          className="group block rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-xl">
              {decider.emoji}
            </span>
            <h3 className="font-bold text-neutral-900">{decider.name}</h3>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">{decider.tagline}</p>
          <p className="mt-3 text-[12px] font-medium text-amber-700 opacity-0 transition group-hover:opacity-100">
            试一试 ↗
          </p>
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
