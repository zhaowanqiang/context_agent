import Link from "next/link";
import { notFound } from "next/navigation";
import { FEWSHOT_MAX, listFewshot } from "@/lib/fewshotStore";
import { db } from "@/lib/supabase";
import type { TrackId } from "@/lib/types";
import { isTrackId, TRACK_LABEL } from "@/lib/types";
import FewshotRowActions from "@/components/FewshotRowActions";

export const dynamic = "force-dynamic";

/** checklist 头部的质检分（confirmOutline 拼入，无独立表列） */
function qualityOf(checklist: string | null): number | null {
  const m = checklist?.match(/【质量自检】([\d.]+)\/10/);
  return m ? Number(m[1]) : null;
}

interface TrendPoint {
  runId: string;
  title: string;
  score: number;
  createdAt: string;
  published: boolean;
}

/** 最近成稿的质检分走势：范例库喂回是否在起作用，就看这条线 */
async function qualityTrend(track: TrackId): Promise<TrendPoint[]> {
  const { data } = await db()
    .from("runs")
    .select("id,title,status,checklist,created_at")
    .eq("track", track)
    .like("checklist", "%【质量自检】%")
    .order("created_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as { id: string; title: string | null; status: string; checklist: string; created_at: string }[])
    .map((r) => ({
      runId: r.id,
      title: r.title ?? "（无标题）",
      score: qualityOf(r.checklist),
      createdAt: r.created_at,
      published: r.status === "published",
    }))
    .filter((p): p is TrendPoint => p.score !== null)
    .reverse(); // 时间升序，旧 → 新
}

export default async function FewshotPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  if (!isTrackId(track)) notFound();

  const [entries, trend] = await Promise.all([listFewshot(track), qualityTrend(track)]);

  // 来源 run 链接：文件名只有 8 位短 id，用近期 run 列表反查全 id
  const { data: runRows } = await db().from("runs").select("id").eq("track", track).limit(500);
  const idByPrefix = new Map(((runRows ?? []) as { id: string }[]).map((r) => [r.id.slice(0, 8), r.id]));

  // 走势解读：前半 vs 后半均分
  const half = Math.floor(trend.length / 2);
  const avg = (ps: TrendPoint[]) => ps.reduce((s, p) => s + p.score, 0) / ps.length;
  const delta = trend.length >= 4 ? avg(trend.slice(half)) - avg(trend.slice(0, half)) : null;

  const autoCount = entries.filter((e) => e.auto).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold">few-shot 范例库 · {TRACK_LABEL[track]}</h1>
        <p className="mt-2 max-w-3xl rounded-md border border-neutral-200 bg-white px-4 py-3 text-xs leading-relaxed text-neutral-500">
          这里不是模型训练——库里的每篇范文会在<b className="text-neutral-700">每次生成成稿时整体注入 prompt</b>，
          存入/删除立即生效。成稿的语气和味道直接由这几篇决定：只留发布后效果好的，发现哪篇带坏风格就删掉。
          （文件在 tracks/{track}/fewshot/，手工放的原始范例不会被自动淘汰）
        </p>
      </div>

      {/* 质量走势：喂回效果的度量 */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-neutral-800">成稿质检分走势（旧 → 新，最近 {trend.length} 篇）</h2>
          {delta !== null && (
            <span className={`text-sm font-medium ${delta >= 0.3 ? "text-green-600" : delta <= -0.3 ? "text-red-600" : "text-neutral-400"}`}>
              后半段均分 {delta >= 0 ? "+" : ""}{delta.toFixed(1)} {delta >= 0.3 ? "——范例在起作用" : delta <= -0.3 ? "——警惕机器味自我强化，检查最近入库的范例" : "（基本持平）"}
            </span>
          )}
        </div>
        {trend.length === 0 ? (
          <p className="text-sm text-neutral-400">还没有带质检分的成稿。走完一次「确认大纲 → 成稿」后这里会出现走势。</p>
        ) : (
          <>
            <div className="flex h-28 items-end gap-1.5">
              {trend.map((p) => (
                <Link
                  key={p.runId}
                  href={`/${track}/runs/${p.runId}`}
                  title={`${p.score.toFixed(1)} 分 · ${p.title} · ${new Date(p.createdAt).toLocaleDateString("zh-CN")}${p.published ? "（已发布）" : ""}`}
                  className={`flex-1 rounded-t transition hover:opacity-70 ${
                    p.score >= 8 ? "bg-green-500" : p.score >= 7 ? "bg-neutral-400" : "bg-amber-400"
                  } ${p.published ? "" : "opacity-50"}`}
                  style={{ height: `${Math.max(8, (p.score / 10) * 100)}%` }}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              <span className="text-green-600">■</span> ≥8 分　<span className="text-neutral-500">■</span> 7–8 分　<span className="text-amber-500">■</span> &lt;7 分　·　半透明 = 未发布　·　点柱子进对应 run
            </p>
          </>
        )}
      </section>

      {/* 库内条目 */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-neutral-800">
            库内范例 {entries.length}/{FEWSHOT_MAX}
            <span className="ml-2 text-xs font-normal text-neutral-400">自动入库 {autoCount} · 手工范例 {entries.length - autoCount}</span>
          </h2>
          {entries.length > FEWSHOT_MAX && (
            <span className="text-xs font-medium text-amber-600">已超上限——删掉表现最弱的，范例太多会稀释风格、增加成本</span>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-400">
            范例库是空的——成稿风格会打折扣。去已发布的 run 页点「★ 存入 few-shot 范例库」。
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white shadow-sm">
            {entries.map((e) => {
              const fullRunId = e.runId8 ? idByPrefix.get(e.runId8) : null;
              return (
                <li key={e.filename} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{e.title}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${e.auto ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-500"}`}>
                          {e.auto ? "从 run 入库" : "手工范例"}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-400">
                        {e.filename} · {e.chars} 字 · {new Date(e.savedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {fullRunId && (
                          <>
                            {" · "}
                            <Link href={`/${track}/runs/${fullRunId}`} className="text-blue-600 hover:underline">来源 run →</Link>
                          </>
                        )}
                      </span>
                      <details className="mt-1">
                        <summary className="cursor-pointer select-none text-xs text-neutral-400 hover:text-neutral-600">预览开头</summary>
                        <p className="mt-1 whitespace-pre-wrap rounded bg-neutral-50 px-3 py-2 text-xs leading-relaxed text-neutral-600">{e.preview}…</p>
                      </details>
                    </span>
                    <FewshotRowActions track={track} filename={e.filename} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
