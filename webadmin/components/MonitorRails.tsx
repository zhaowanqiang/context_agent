import Link from "next/link";
import { db } from "@/lib/supabase";
import { STATUS_LABEL, type RunStatus } from "@/lib/types";

/** /monitor 三栏布局的左右侧栏（服务端组件；数据查不到时静默降级为不渲染） */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{title}</h3>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-[13px]">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-800">{value}</span>
    </div>
  );
}

/** "0 9 * * *" → 每天 09:00；非常规表达式原样显示 */
function cronLabel(expr: string): string {
  if (expr === "off") return "已关闭";
  const m = expr.trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
  return m ? `每天 ${m[2].padStart(2, "0")}:${m[1].padStart(2, "0")}` : expr;
}

interface LeftRailData {
  total: number;
  month: number;
  latest: { created_at: string; item_count: number | null } | null;
  tokensIn: number;
  tokensOut: number;
  callCount: number;
  xpostCount: number;
}

async function leftRailData(): Promise<LeftRailData | null> {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [total, month, latest, calls, xpostCount] = await Promise.all([
      db().from("briefings").select("*", { count: "exact", head: true }),
      db().from("briefings").select("*", { count: "exact", head: true })
        .gte("created_at", monthStart.toISOString()),
      db().from("briefings").select("created_at, item_count")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db().from("llm_calls").select("step, input_tokens, output_tokens")
        .in("step", ["briefing", "xpost_from_briefing"])
        .gte("created_at", monthStart.toISOString()),
      db().from("runs").select("*", { count: "exact", head: true })
        .eq("track", "x").like("material", "【简报选题%"),
    ]);
    if (total.error || calls.error) return null;
    const tokens = (calls.data ?? []).reduce(
      (s, c) => ({ inp: s.inp + c.input_tokens, out: s.out + c.output_tokens }),
      { inp: 0, out: 0 }
    );
    return {
      total: total.count ?? 0,
      month: month.count ?? 0,
      latest: latest.data ?? null,
      tokensIn: tokens.inp,
      tokensOut: tokens.out,
      callCount: (calls.data ?? []).length,
      xpostCount: xpostCount.count ?? 0,
    };
  } catch {
    return null;
  }
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

export async function MonitorLeftRail() {
  const d = await leftRailData();
  if (!d) return null;
  return (
    <>
      <Card title="简报概况">
        <Row label="累计期数" value={d.total} />
        <Row label="本月" value={`${d.month} 期`} />
        {d.latest && (
          <Row
            label="上次一期"
            value={`${new Date(d.latest.created_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} · ${d.latest.item_count ?? 0} 条`}
          />
        )}
        <Row label="定时生成" value={cronLabel(process.env.BRIEFING_CRON ?? "0 9 * * *")} />
        <Row label="已转 X 帖" value={`${d.xpostCount} 篇`} />
      </Card>
      <Card title="本月用量（简报+转帖）">
        <Row label="Token" value={fmt(d.tokensIn + d.tokensOut)} />
        <Row label="输入 / 输出" value={`${fmt(d.tokensIn)} / ${fmt(d.tokensOut)}`} />
        <Row label="LLM 调用" value={`${d.callCount} 次`} />
      </Card>
      <Card title="快捷入口">
        <ul className="space-y-1.5 text-[13px]">
          <li><a href="#topics" className="text-neutral-600 hover:text-neutral-900">⚙️ 管理监控话题 ↓</a></li>
          <li><Link href="/agent/x/runs" className="text-neutral-600 hover:text-neutral-900">📝 X 轨 Runs（审转帖稿）</Link></li>
          <li><Link href="/agent/x/fewshot" className="text-neutral-600 hover:text-neutral-900">⭐ X 轨范例库</Link></li>
        </ul>
      </Card>
    </>
  );
}

interface XPostRunRow {
  id: string;
  title: string | null;
  status: string;
}

async function xpostDrafts(): Promise<XPostRunRow[]> {
  try {
    const { data, error } = await db()
      .from("runs")
      .select("id, title, status")
      .eq("track", "x")
      .like("material", "【简报选题%")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return [];
    return (data ?? []) as XPostRunRow[];
  } catch {
    return [];
  }
}

const STATUS_BADGE: Record<string, string> = {
  draft_review: "bg-amber-50 text-amber-700",
  published: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-600",
};

/** 最近由简报转出的 X 帖草稿（右栏，点进工作台继续） */
export async function XPostDraftsRail() {
  const rows = await xpostDrafts();
  if (rows.length === 0) return null;
  return (
    <Card title="最近转帖草稿">
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/agent/x/runs/${r.id}`} className="group block">
              <span className="flex items-center gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${STATUS_BADGE[r.status] ?? "bg-neutral-100 text-neutral-500"}`}>
                  {STATUS_LABEL[r.status as RunStatus] ?? r.status}
                </span>
                <span className="truncate text-xs text-neutral-600 group-hover:text-neutral-900">
                  {(r.title ?? "（无标题）").replace(/^【X帖】/, "")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
