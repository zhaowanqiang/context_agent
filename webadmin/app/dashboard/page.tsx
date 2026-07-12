import type { Metadata } from "next";
import Link from "next/link";
import { parseBriefingItems } from "@/lib/briefingItems";
import { latestReport } from "@/lib/pipelineLog";
import { db } from "@/lib/supabase";
import type { Run, TrackId } from "@/lib/types";
import { TRACK_LABEL, TRACKS } from "@/lib/types";
import RunStatusBadge from "@/components/RunStatusBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "工作台" };

/* 工作台总览：回答「今天有什么等我处理」。
   日常动线一条主线：看简报 → 转 X 帖 → 审稿发布 → 回流个人站，
   这里是主线的起点——所有待办直达，不用逐模块巡逻。 */

type PendingRun = Pick<Run, "id" | "title" | "status" | "updated_at">;

interface TrackPending {
  track: TrackId;
  runs: PendingRun[];
  count: number;
}

async function pendingByTrack(): Promise<TrackPending[] | null> {
  try {
    return await Promise.all(
      TRACKS.map(async (track) => {
        const [{ data }, { count }] = await Promise.all([
          db().from("runs").select("id, title, status, updated_at")
            .eq("track", track).in("status", ["outline_review", "draft_review", "failed"])
            .order("updated_at", { ascending: false }).limit(5),
          db().from("runs").select("*", { count: "exact", head: true })
            .eq("track", track).in("status", ["outline_review", "draft_review", "failed"]),
        ]);
        return { track, runs: (data ?? []) as PendingRun[], count: count ?? 0 };
      })
    );
  } catch {
    return null;
  }
}

interface BriefingStat {
  id: string;
  title: string;
  createdAt: string;
  topicWorthy: number;
  xDrafts: number;
}

async function briefingStat(): Promise<BriefingStat | null> {
  try {
    const [{ data: b }, { count: xDrafts }] = await Promise.all([
      db().from("briefings").select("id, title, created_at, body_md")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db().from("runs").select("*", { count: "exact", head: true })
        .eq("track", "x").eq("status", "draft_review").like("material", "【简报选题%"),
    ]);
    if (!b) return null;
    const topicWorthy = parseBriefingItems(b.body_md).filter((i) => i.mark === "可做选题").length;
    return { id: b.id, title: b.title, createdAt: b.created_at, topicWorthy, xDrafts: xDrafts ?? 0 };
  } catch {
    return null;
  }
}

interface MonthUsage {
  tokens: number;
  calls: number;
}

async function monthUsage(): Promise<MonthUsage | null> {
  try {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data } = await db().from("llm_calls")
      .select("input_tokens, output_tokens").gte("created_at", monthStart).limit(2000);
    const tokens = (data ?? []).reduce((s, r) => s + r.input_tokens + r.output_tokens, 0);
    return { tokens, calls: data?.length ?? 0 };
  } catch {
    return null;
  }
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const QUICK_ACTIONS = [
  { href: "/agent/wechat/runs/new", label: "＋ 新建公众号 Run", desc: "粘素材直接开写" },
  { href: "/agent/x/runs/new", label: "＋ 新建 X Run", desc: "实测笔记转干货帖" },
  { href: "/publish", label: "发布中心", desc: "排期 · 效果回填" },
  { href: "/clips", label: "剪藏收件箱", desc: "随手存素材" },
  { href: "/agent/wechat/topics", label: "选题池 · 公众号", desc: "抓取 & 打分补货" },
  { href: "/agent/x/topics", label: "选题池 · X", desc: "GitHub 热门库等" },
  { href: "/monitor", label: "监控简报", desc: "手动跑一期 / 转帖" },
  { href: "/posts", label: "个人站文章", desc: "已回流的公开存档" },
];

export default async function DashboardPage() {
  const [pending, briefing, usage, reports] = await Promise.all([
    pendingByTrack(),
    briefingStat(),
    monthUsage(),
    Promise.all(TRACKS.map((t) => latestReport(t))),
  ]);
  const totalPending = pending?.reduce((s, p) => s + p.count, 0) ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-5 pt-2">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">工作台</h1>
          <p className="mt-1 text-[12.5px] text-neutral-400">
            {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}
            {" · "}
            {totalPending > 0 ? (
              <span className="font-medium text-amber-700">{totalPending} 项等你处理</span>
            ) : (
              "全部处理完毕"
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 待你处理：占两列，双轨并排 */}
        <div className="lg:col-span-2">
          <Card title="待你处理">
            {pending === null ? (
              <p className="text-[13px] text-neutral-400">读取失败——检查 Supabase 连接。</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {pending.map(({ track, runs, count }) => (
                  <div key={track}>
                    <Link
                      href={`/agent/${track}`}
                      className="flex items-baseline justify-between rounded-md px-1 py-0.5 transition hover:bg-neutral-50"
                    >
                      <span className="text-sm font-bold text-neutral-900">{TRACK_LABEL[track]}</span>
                      <span className={`text-[12px] font-medium ${count > 0 ? "text-amber-600" : "text-neutral-400"}`}>
                        {count > 0 ? `${count} 项` : "干净 ✓"}
                      </span>
                    </Link>
                    <ul className="mt-2 space-y-1">
                      {runs.map((r) => (
                        <li key={r.id}>
                          <Link
                            href={`/agent/${track}/runs/${r.id}`}
                            className="group flex items-center gap-2 rounded-md px-1 py-1 transition hover:bg-neutral-50"
                          >
                            <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-700 group-hover:text-neutral-900">
                              {r.title ?? "（未出大纲）"}
                            </span>
                            <RunStatusBadge status={r.status} />
                          </Link>
                        </li>
                      ))}
                      {runs.length === 0 && (
                        <li className="px-1 py-1 text-[12px] text-neutral-300">没有待办</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 监控简报：主线起点 */}
        <Card
          title="监控简报"
          action={
            <Link href="/monitor" className="text-[12px] text-neutral-400 transition hover:text-amber-700">
              全部 →
            </Link>
          }
        >
          {briefing === null ? (
            <p className="text-[13px] text-neutral-400">还没有简报——去 /monitor 跑第一期。</p>
          ) : (
            <div className="space-y-2.5 text-[13px]">
              <Link href={`/monitor/${briefing.id}`} className="block font-medium text-neutral-800 transition hover:text-amber-700">
                {briefing.title}
              </Link>
              <p className="text-[12px] text-neutral-400">
                {new Date(briefing.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
              <dl className="space-y-1.5 border-t border-neutral-100 pt-2.5">
                <div className="flex items-baseline justify-between">
                  <dt className="text-neutral-500">可做选题</dt>
                  <dd className={`font-bold ${briefing.topicWorthy > 0 ? "text-amber-600" : "text-neutral-400"}`}>
                    {briefing.topicWorthy} 条
                  </dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-neutral-500">转帖草稿待审</dt>
                  <dd className={`font-bold ${briefing.xDrafts > 0 ? "text-amber-600" : "text-neutral-400"}`}>
                    {briefing.xDrafts} 篇
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </Card>

        {/* 产线状态 */}
        <Card title="产线状态">
          <dl className="space-y-2.5 text-[13px]">
            {TRACKS.map((t, i) => {
              const rep = reports[i];
              const ok = rep?.created.filter((c) => c.ok).length ?? 0;
              return (
                <div key={t} className="flex items-baseline justify-between">
                  <dt className="text-neutral-500">{TRACK_LABEL[t]}</dt>
                  <dd className="text-neutral-700">
                    {rep ? (
                      <>
                        {new Date(rep.ranAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                        {" 产出 "}
                        <b className={ok > 0 ? "text-green-600" : "text-neutral-500"}>{ok}</b> 篇
                      </>
                    ) : (
                      <span className="text-neutral-300">还没跑过</span>
                    )}
                  </dd>
                </div>
              );
            })}
            <div className="flex items-baseline justify-between border-t border-neutral-100 pt-2.5">
              <dt className="text-neutral-500">定时</dt>
              <dd className="text-[12px] text-neutral-400">产线 08:00 · 简报 09:00</dd>
            </div>
          </dl>
        </Card>

        {/* 本月用量 */}
        <Card title="本月用量">
          {usage === null ? (
            <p className="text-[13px] text-neutral-400">读取失败。</p>
          ) : (
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex items-baseline justify-between">
                <dt className="text-neutral-500">Token</dt>
                <dd className="font-bold text-neutral-800">{(usage.tokens / 1000).toFixed(1)}K</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-neutral-500">LLM 调用</dt>
                <dd className="font-bold text-neutral-800">{usage.calls} 次</dd>
              </div>
              <p className="border-t border-neutral-100 pt-2.5 text-[11px] leading-relaxed text-neutral-400">
                全站合计（产线 + 简报 + 转帖）。DeepSeek 计价下约 ¥{((usage.tokens / 1_000_000) * 4).toFixed(1)}。
              </p>
            </dl>
          )}
        </Card>

        {/* 快捷动作 */}
        <Card title="快捷动作">
          <ul className="-mx-1 space-y-0.5">
            {QUICK_ACTIONS.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="group flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 transition hover:bg-neutral-50"
                >
                  <span className="text-[13px] font-medium text-neutral-700 group-hover:text-neutral-900">{a.label}</span>
                  <span className="text-[11px] text-neutral-400">{a.desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
