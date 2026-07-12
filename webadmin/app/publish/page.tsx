import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/supabase";
import type { Publication, PublicationStats, Run, TrackId } from "@/lib/types";
import { STATS_FIELDS, TRACK_LABEL } from "@/lib/types";
import PlannedDateInput from "@/components/PlannedDateInput";
import StatsFillForm from "@/components/StatsFillForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "发布中心" };

/* 发布中心：补上价值环的后半段——
   ① 发布队列：draft_review 的稿子排期，不再靠记忆
   ② 效果回填：发布后手动填数据（X API 免费层拉不到，手填是务实解）
   ③ 命中率：选题来源 × 实际效果，反哺「什么值得写」 */

type QueueRun = Pick<Run, "id" | "track" | "title" | "planned_publish_on" | "updated_at">;
type PubRow = Publication & { runs: Pick<Run, "track" | "material"> | null };

/** 选题来源归类（从素材前缀推断，与产线契约对应） */
function sourceOf(material: string | undefined): string {
  if (!material) return "手动";
  if (material.startsWith("【简报选题")) return "简报";
  if (material.includes("GitHub 仓库档案")) return "GitHub";
  if (material.startsWith("【选题】")) return "RSS 选题";
  return "手动";
}

function fmtStats(channel: string, stats: PublicationStats | null): string {
  if (!stats) return "";
  const fields = STATS_FIELDS[channel] ?? [];
  return fields
    .filter((f) => stats[f.key] != null)
    .map((f) => `${f.label} ${stats[f.key].toLocaleString()}`)
    .join(" · ");
}

export default async function PublishPage() {
  let queue: QueueRun[] = [];
  let pubs: PubRow[] = [];
  let dbError: string | null = null;
  try {
    const [queueRes, pubsRes] = await Promise.all([
      db()
        .from("runs")
        .select("id, track, title, planned_publish_on, updated_at")
        .eq("status", "draft_review")
        .order("planned_publish_on", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(30),
      db()
        .from("publications")
        .select("*, runs(track, material)")
        .order("published_at", { ascending: false })
        .limit(60),
    ]);
    if (queueRes.error) throw new Error(queueRes.error.message);
    if (pubsRes.error) throw new Error(pubsRes.error.message);
    queue = (queueRes.data ?? []) as QueueRun[];
    pubs = (pubsRes.data ?? []) as unknown as PubRow[];
  } catch (e) {
    dbError = (e as Error).message;
  }

  const unfilled = pubs.filter((p) => !p.stats);
  const filled = pubs.filter((p) => p.stats);

  // 命中率：来源 × 平均互动（各渠道第二个指标≈互动/在看，最能代表内容质量）
  const bySource = new Map<string, { n: number; sum: number }>();
  for (const p of filled) {
    const src = sourceOf(p.runs?.material);
    const secondKey = (STATS_FIELDS[p.channel] ?? [])[1]?.key;
    const v = secondKey ? p.stats?.[secondKey] : undefined;
    if (v == null) continue;
    const cur = bySource.get(src) ?? { n: 0, sum: 0 };
    bySource.set(src, { n: cur.n + 1, sum: cur.sum + v });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">发布中心</h1>
        <p className="mt-1 text-[12.5px] text-neutral-400">
          排期 → 发布 → 回填效果数据——哪类选题值得写，让数据说话。
        </p>
      </div>

      {dbError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          读取失败：{dbError}（若提示列不存在，先在 Supabase SQL Editor 执行 schema.sql 里 2026-07-12 增量段）
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 发布队列 */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            发布队列（待审终稿 {queue.length}）
          </h2>
          {queue.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-neutral-400">队列空——产线跑起来就有了。</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {queue.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-20 shrink-0 text-[11px] text-neutral-400">{TRACK_LABEL[r.track as TrackId]}</span>
                  <Link
                    href={`/agent/${r.track}/runs/${r.id}`}
                    className="min-w-0 flex-1 truncate text-[13.5px] text-neutral-700 transition hover:text-amber-700"
                  >
                    {r.title ?? "（未出大纲）"}
                  </Link>
                  <PlannedDateInput runId={r.id} value={r.planned_publish_on} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 命中率 */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            选题命中率（来源 × 平均互动）
          </h2>
          {bySource.size === 0 ? (
            <p className="py-6 text-center text-[13px] text-neutral-400">
              还没有回填数据——下方「待回填」填几条就有了。
            </p>
          ) : (
            <ul className="space-y-2">
              {[...bySource.entries()]
                .sort((a, b) => b[1].sum / b[1].n - a[1].sum / a[1].n)
                .map(([src, { n, sum }]) => (
                  <li key={src} className="flex items-baseline justify-between text-[13.5px]">
                    <span className="text-neutral-600">{src}</span>
                    <span className="text-neutral-800">
                      <b className="tabular-nums">{Math.round(sum / n).toLocaleString()}</b>
                      <span className="ml-1.5 text-[11.5px] text-neutral-400">均值 · {n} 篇</span>
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-4 border-t border-neutral-100 pt-3 text-[11.5px] leading-relaxed text-neutral-400">
            互动 = X 的 engagements / 公众号的在看。样本攒到 10+ 篇后，低命中来源的选题分门槛可以在 prompt 里调高。
          </p>
        </section>
      </div>

      {/* 待回填 */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          待回填（{unfilled.length}）——发布 48h 后填，十秒钟
        </h2>
        {unfilled.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-neutral-400">全部回填完毕 ✓</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {unfilled.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <span className="w-20 shrink-0 text-[11px] text-neutral-400">
                  {p.runs ? TRACK_LABEL[p.runs.track as TrackId] : p.channel}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-neutral-700">
                  {p.title ?? "（无标题）"}
                  <span className="ml-2 text-[11.5px] text-neutral-400">
                    {new Date(p.published_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} 发布
                    {" · "}
                    {sourceOf(p.runs?.material)}
                  </span>
                </span>
                <StatsFillForm
                  publicationId={p.id}
                  fields={STATS_FIELDS[p.channel] ?? [{ key: "engagements", label: "互动" }]}
                  current={p.stats}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 已回填 */}
      {filled.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            效果记录（{filled.length}）
          </h2>
          <ul className="divide-y divide-neutral-100">
            {filled.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className="w-20 shrink-0 text-[11px] text-neutral-400">
                  {p.runs ? TRACK_LABEL[p.runs.track as TrackId] : p.channel}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-neutral-700">{p.title ?? "（无标题）"}</span>
                <span className="text-[12.5px] tabular-nums text-neutral-500">{fmtStats(p.channel, p.stats)}</span>
                <span className="text-[11px] text-neutral-300">{sourceOf(p.runs?.material)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
