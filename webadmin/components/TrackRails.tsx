import Link from "next/link";
import { qualityOf } from "@/lib/checklist";
import { FEWSHOT_MAX, listFewshot } from "@/lib/fewshotStore";
import { latestReport } from "@/lib/pipelineLog";
import { db } from "@/lib/supabase";
import type { Run, TrackId } from "@/lib/types";

/* 轨道内所有页面共享的双侧栏（xl 起显示）：左=行动，右=情报。
   数据在 layout 里经 Suspense 流式注入，不阻塞主内容。 */

function Card({ title, children, tone = "default" }: { title: string; children: React.ReactNode; tone?: "default" | "alert" }) {
  return (
    <section
      className={`rounded-lg border p-4 shadow-sm ${
        tone === "alert" ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"
      }`}
    >
      <h3 className={`mb-2.5 text-[11px] font-semibold uppercase tracking-wider ${tone === "alert" ? "text-red-600" : "text-neutral-400"}`}>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function RailSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-lg border border-neutral-200 bg-white p-4">
          <div className="h-2.5 w-16 rounded bg-neutral-100" />
          <div className="mt-3 h-3 w-full rounded bg-neutral-100" />
          <div className="mt-2 h-3 w-2/3 rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

// ── 左栏：快捷操作 + 本周节奏 + 本月用量 ────────────────────────────

export async function LeftRail({ track }: { track: TrackId }) {
  const now = new Date();
  // 本周从周一零点起
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [{ count: weekPublished }, { count: weekRuns }, { count: pending }, { data: monthRows }] = await Promise.all([
    db().from("runs").select("*", { count: "exact", head: true })
      .eq("track", track).eq("status", "published").gte("updated_at", monday.toISOString()),
    db().from("runs").select("*", { count: "exact", head: true })
      .eq("track", track).gte("created_at", monday.toISOString()),
    db().from("runs").select("*", { count: "exact", head: true })
      .eq("track", track).in("status", ["outline_review", "draft_review", "failed"]),
    db().from("runs").select("token_usage")
      .eq("track", track).gte("created_at", monthStart.toISOString()).not("token_usage", "is", null).limit(500),
  ]);

  const month = (monthRows ?? []).reduce(
    (s, r) => {
      const u = r.token_usage as { input_tokens: number; output_tokens: number } | null;
      return u ? { i: s.i + u.input_tokens, o: s.o + u.output_tokens, n: s.n + 1 } : s;
    },
    { i: 0, o: 0, n: 0 }
  );

  const ACTIONS = [
    { href: `/agent/${track}/runs/new`, label: "＋ 新建 Run", desc: "粘素材直接开写" },
    { href: `/agent/${track}/topics`, label: "抓取 & 打分", desc: "选题池补货" },
    { href: `/agent/${track}/runs?status=draft_review`, label: "待审终稿", desc: "核对后发布" },
    { href: `/agent/${track}/fewshot`, label: "范例库", desc: "维护语气范文" },
  ];

  return (
    <div className="space-y-4">
      <Card title="快捷操作">
        <ul className="-mx-1 space-y-0.5">
          {ACTIONS.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="group flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-50">
                <span className="text-[13px] font-medium text-neutral-700 group-hover:text-neutral-900">{a.label}</span>
                <span className="text-[11px] text-neutral-400">{a.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="本周节奏">
        <dl className="space-y-2 text-[13px]">
          <div className="flex items-baseline justify-between">
            <dt className="text-neutral-500">发布</dt>
            <dd className={`font-bold ${(weekPublished ?? 0) > 0 ? "text-green-600" : "text-neutral-400"}`}>
              {weekPublished ?? 0} 篇
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-neutral-500">新开 run</dt>
            <dd className="font-bold text-neutral-800">{weekRuns ?? 0}</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-neutral-500">等你处理</dt>
            <dd className={`font-bold ${(pending ?? 0) > 0 ? "text-amber-600" : "text-neutral-400"}`}>{pending ?? 0}</dd>
          </div>
        </dl>
        {(weekPublished ?? 0) === 0 && (
          <p className="mt-2.5 border-t border-neutral-100 pt-2 text-[11px] leading-relaxed text-neutral-400">
            本周还没发布——选题池挑一个高分的，一键到成稿只要几分钟。
          </p>
        )}
      </Card>

      <Card title="本月用量">
        <dl className="space-y-2 text-[13px]">
          <div className="flex items-baseline justify-between">
            <dt className="text-neutral-500">Token</dt>
            <dd className="font-bold text-neutral-800">{((month.i + month.o) / 1000).toFixed(1)}K</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-neutral-500">输入 / 输出</dt>
            <dd className="text-neutral-600">{(month.i / 1000).toFixed(0)}K / {(month.o / 1000).toFixed(0)}K</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-neutral-500">带用量的 run</dt>
            <dd className="text-neutral-600">{month.n} 个</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

// ── 右栏：异常警报 + 范例库健康度 + 最近发布 + 自动产线 ─────────────

function cronLabel(expr: string): string {
  if (expr === "off") return "已关闭";
  const m = expr.match(/^(\d{1,2}) (\d{1,2}) \* \* \*$/);
  if (m) return `每天 ${m[2].padStart(2, "0")}:${m[1].padStart(2, "0")}`;
  return expr; // 非常规表达式原样展示
}

export async function RightRail({ track }: { track: TrackId }) {
  // 服务端组件按请求执行，取当前时间是安全的
  // eslint-disable-next-line react-hooks/purity
  const stuckBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const [{ data: failedRows }, { data: stuckRows }, { data: publishedRows }, { data: qualityRows }, fewshot, report] =
    await Promise.all([
      db().from("runs").select("id,title,error,updated_at")
        .eq("track", track).eq("status", "failed").order("updated_at", { ascending: false }).limit(3),
      db().from("runs").select("id,title,status,updated_at")
        .eq("track", track).in("status", ["outlining", "drafting", "gating"]).lt("updated_at", stuckBefore).limit(3),
      db().from("runs").select("id,title,updated_at")
        .eq("track", track).eq("status", "published").order("updated_at", { ascending: false }).limit(5),
      db().from("runs").select("id,checklist,created_at")
        .eq("track", track).like("checklist", "%【质量自检】%").order("created_at", { ascending: false }).limit(8),
      listFewshot(track),
      latestReport(track),
    ]);

  const failed = (failedRows ?? []) as Pick<Run, "id" | "title" | "error" | "updated_at">[];
  const stuck = (stuckRows ?? []) as Pick<Run, "id" | "title" | "status" | "updated_at">[];
  const published = (publishedRows ?? []) as Pick<Run, "id" | "title" | "updated_at">[];
  const scores = ((qualityRows ?? []) as { id: string; checklist: string }[])
    .map((r) => ({ id: r.id, score: qualityOf(r.checklist) }))
    .filter((s): s is { id: string; score: number } => s.score !== null)
    .reverse(); // 旧 → 新

  const cron = cronLabel(process.env.AUTOPILOT_CRON ?? "0 8 * * *");
  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      {(failed.length > 0 || stuck.length > 0) && (
        <Card title="需要处理" tone="alert">
          <ul className="space-y-2">
            {failed.map((r) => (
              <li key={r.id}>
                <Link href={`/agent/${track}/runs/${r.id}`} className="group block">
                  <span className="block truncate text-[13px] font-medium text-red-800 group-hover:underline">
                    ✗ {r.title ?? "（未出大纲）"}
                  </span>
                  <span className="block truncate text-[11px] text-red-500">
                    失败：{r.error ?? "未知原因"} · 可重试
                  </span>
                </Link>
              </li>
            ))}
            {stuck.map((r) => (
              <li key={r.id}>
                <Link href={`/agent/${track}/runs/${r.id}`} className="group block">
                  <span className="block truncate text-[13px] font-medium text-red-800 group-hover:underline">
                    ⏳ {r.title ?? "（未出大纲）"}
                  </span>
                  <span className="block text-[11px] text-red-500">
                    卡在 {r.status} 超 10 分钟 · 打开页面可重置
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="范例库健康度">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-neutral-500">范文</span>
          <span className={`text-[13px] font-bold ${fewshot.length > FEWSHOT_MAX ? "text-amber-600" : "text-neutral-800"}`}>
            {fewshot.length}/{FEWSHOT_MAX}
          </span>
        </div>
        {scores.length >= 2 && (
          <>
            <div className="mt-2.5 flex h-9 items-end gap-1">
              {scores.map((s) => (
                <Link
                  key={s.id}
                  href={`/agent/${track}/runs/${s.id}`}
                  title={`质检 ${s.score.toFixed(1)} 分`}
                  className={`flex-1 rounded-t hover:opacity-70 ${
                    s.score >= 8 ? "bg-green-500" : s.score >= 7 ? "bg-neutral-300" : "bg-amber-400"
                  }`}
                  style={{ height: `${Math.max(12, (s.score / 10) * 100)}%` }}
                />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">最近 {scores.length} 篇质检分（旧→新）</p>
          </>
        )}
        <Link href={`/agent/${track}/fewshot`} className="mt-2 block text-[11px] text-amber-700 hover:underline">
          管理范例与完整走势 →
        </Link>
      </Card>

      <Card title="最近发布">
        {published.length === 0 ? (
          <p className="text-[12px] text-neutral-400">还没有发布记录。</p>
        ) : (
          <ul className="space-y-2">
            {published.map((r) => (
              <li key={r.id}>
                <Link href={`/agent/${track}/runs/${r.id}`} className="group block">
                  <span className="block truncate text-[13px] text-neutral-700 group-hover:text-neutral-900 group-hover:underline">
                    {r.title ?? "（无标题）"}
                  </span>
                  <span className="block text-[11px] text-neutral-400">{dateFmt(r.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="自动产线">
        <dl className="space-y-2 text-[13px]">
          <div className="flex items-baseline justify-between">
            <dt className="text-neutral-500">定时</dt>
            <dd className="font-medium text-neutral-800">{cron}</dd>
          </div>
          {report && (
            <>
              <div className="flex items-baseline justify-between">
                <dt className="text-neutral-500">上次</dt>
                <dd className="text-neutral-600">{dateFmt(report.ranAt)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-neutral-500">产出</dt>
                <dd className="text-neutral-600">
                  {report.created.filter((c) => c.ok).length} 篇待审
                  {report.skipped.length > 0 && ` · 跳过 ${report.skipped.length}`}
                </dd>
              </div>
            </>
          )}
        </dl>
        <p className="mt-2.5 border-t border-neutral-100 pt-2 text-[11px] leading-relaxed text-neutral-400">
          仅本机开机且服务运行时触发；也可在仪表盘手动跑一次。
        </p>
      </Card>
    </div>
  );
}
