import Link from "next/link";
import { notFound } from "next/navigation";
import { agent } from "@/lib/agent";
import { latestReport } from "@/lib/pipelineLog";
import { db } from "@/lib/supabase";
import type { FeedItem, Run, TrackId } from "@/lib/types";
import { isTrackId, TRACK_LABEL } from "@/lib/types";
import AutopilotButton from "@/components/AutopilotButton";
import RunStatusBadge from "@/components/RunStatusBadge";
import TopicRowActions from "@/components/TopicRowActions";

export const dynamic = "force-dynamic";

async function healthLight() {
  try {
    const h = await agent.health();
    return { ok: true, text: `${h.provider} · ${h.strong_model} / ${h.gate_model}` };
  } catch (e) {
    return { ok: false, text: (e as Error).message };
  }
}

function StatCard({ label, value, sub, href }: { label: string; value: string | number; sub?: string; href?: string }) {
  const inner = (
    <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4 shadow-sm transition hover:border-neutral-300">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function RunRow({ r }: { r: Run }) {
  return (
    <li>
      <Link href={`/${r.track}/runs/${r.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50">
        <span className="min-w-0 flex-1 truncate text-sm">{r.title ?? r.material.slice(0, 40)}</span>
        <RunStatusBadge status={r.status} />
      </Link>
    </li>
  );
}

export default async function TrackDashboard({ params }: { params: Promise<{ track: string }> }) {
  const { track: raw } = await params;
  if (!isTrackId(raw)) notFound();
  const track: TrackId = raw;

  // 与下方 Supabase 查询并行，别让 Python 健康检查串行阻塞首页
  const healthPromise = healthLight();
  const reportPromise = latestReport(track);

  // 数据获取放 try 里，JSX 放外面 —— React 渲染是惰性的，try/catch 包 JSX 兜不住渲染错误
  let dbError: string | null = null;
  let pending: Run[] = [];
  let recent: Run[] = [];
  let topics: FeedItem[] = [];
  let publishedCount = 0;
  let scoredCount = 0;
  let shortlistedCount = 0;
  let tokens = { i: 0, o: 0 };
  try {
    const [
      { data: actionRuns },
      { data: recentRuns },
      { count: published },
      { count: scored },
      { count: shortlisted },
      { data: topTopics },
      { data: usageRows },
    ] = await Promise.all([
      db()
        .from("runs")
        .select("*")
        .eq("track", track)
        .in("status", ["outline_review", "draft_review", "failed"])
        .order("updated_at", { ascending: false })
        .limit(6),
      db().from("runs").select("*").eq("track", track).order("created_at", { ascending: false }).limit(6),
      db().from("runs").select("*", { count: "exact", head: true }).eq("track", track).eq("status", "published"),
      db().from("feed_items").select("*", { count: "exact", head: true }).eq("track", track).eq("status", "scored"),
      db().from("feed_items").select("*", { count: "exact", head: true }).eq("track", track).eq("status", "shortlisted"),
      db()
        .from("feed_items")
        .select("*")
        .eq("track", track)
        .eq("status", "scored")
        .gte("score", 7)
        .order("score", { ascending: false })
        .limit(5),
      db().from("runs").select("token_usage").eq("track", track).not("token_usage", "is", null).limit(500),
    ]);

    pending = (actionRuns ?? []) as Run[];
    recent = (recentRuns ?? []) as Run[];
    topics = (topTopics ?? []) as FeedItem[];
    publishedCount = published ?? 0;
    scoredCount = scored ?? 0;
    shortlistedCount = shortlisted ?? 0;
    tokens = (usageRows ?? []).reduce(
      (s, r) => {
        const u = r.token_usage as { input_tokens: number; output_tokens: number } | null;
        return u ? { i: s.i + u.input_tokens, o: s.o + u.output_tokens } : s;
      },
      { i: 0, o: 0 }
    );
  } catch (e) {
    dbError = (e as Error).message;
  }

  const health = await healthPromise;
  const report = await reportPromise;

  const view = dbError ? (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      Supabase 连接失败：{dbError}
    </div>
  ) : (
    <>
      {/* 数据概览 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="等你处理"
          value={pending.length}
          sub="改大纲 / 核清单 / 失败重试"
          href={`/${track}/runs`}
        />
        <StatCard label="已发布" value={publishedCount} sub="本轨道累计" href={`/${track}/runs?status=published`} />
        <StatCard
          label="选题池"
          value={scoredCount}
          sub={`已打分待筛${shortlistedCount ? ` · 候选 ${shortlistedCount}` : ""}`}
          href={`/${track}/topics`}
        />
        <StatCard
          label="Token 累计"
          value={`${((tokens.i + tokens.o) / 1000).toFixed(1)}K`}
          sub={`输入 ${(tokens.i / 1000).toFixed(1)}K / 输出 ${(tokens.o / 1000).toFixed(1)}K`}
        />
      </div>

      {/* grid-cols-1 + min-w-0 缺一不可：隐式列会按 truncate 文本的固有宽度撑爆手机布局 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 左：等你动手的 + 最近 */}
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="mb-2 text-[15px] font-semibold text-neutral-800">等你动手</h2>
            {pending.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-400">
                没有待处理的 run，去选题池挑一个开写？
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white shadow-sm">
                {pending.map((r) => (
                  <RunRow key={r.id} r={r} />
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-neutral-800">最近的 Runs</h2>
              <Link href={`/${track}/runs`} className="text-xs text-blue-600 hover:underline">
                全部 →
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-400">
                还没有记录，<Link href={`/${track}/runs/new`} className="text-blue-600 hover:underline">新建第一条 →</Link>
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white shadow-sm">
                {recent.map((r) => (
                  <RunRow key={r.id} r={r} />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 右：高分选题 */}
        <section className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-neutral-800">高分选题（≥7 分）</h2>
            <Link href={`/${track}/topics`} className="text-xs text-blue-600 hover:underline">
              选题池 →
            </Link>
          </div>
          {topics.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-400">
              暂无高分选题 —— 去选题池「抓取全部源」再「AI 打分」
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white shadow-sm">
              {topics.map((it) => (
                <li key={it.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 w-9 shrink-0 text-center text-sm font-bold text-green-600">
                    {Number(it.score).toFixed(1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <a
                      href={it.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {it.title}
                    </a>
                    {it.suggested_angle && (
                      <span className="mt-0.5 block truncate text-xs text-blue-700">角度：{it.suggested_angle}</span>
                    )}
                  </span>
                  <TopicRowActions id={it.id} status={it.status} track={track} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* 服务状态：常态时收成一行小字，出问题才显眼；手机上标题和产线按钮上下堆叠 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="sm:pt-2">
          <h1 className="text-lg font-bold">{TRACK_LABEL[track]} · 仪表盘</h1>
          {health.ok ? (
            <p className="mt-1 text-xs text-neutral-400">
              <span className="text-green-500">●</span> Python 服务正常 · {health.text}
            </p>
          ) : (
            <p className="mt-1 text-xs text-red-700">○ {health.text}</p>
          )}
        </div>
        <AutopilotButton track={track} />
      </div>
      {report && (
        <p className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-xs text-neutral-500">
          上次产线：{new Date(report.ranAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" · "}产出 {report.created.filter((c) => c.ok).length} 篇待审
          {report.retried.length > 0 && ` · 重试失败稿 ${report.retried.filter((r) => r.ok).length}/${report.retried.length} 成功`}
          {report.created.some((c) => !c.ok) && ` · ${report.created.filter((c) => !c.ok).length} 篇失败`}
          {report.skipped.length > 0 && ` · 跳过 ${report.skipped.length}`}
          {" —— "}
          <Link href={`/${track}/runs?status=draft_review`} className="text-blue-600 hover:underline">
            去核对 →
          </Link>
        </p>
      )}
      {view}
    </div>
  );
}
