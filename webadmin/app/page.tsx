import Link from "next/link";
import { db } from "@/lib/supabase";
import { TRACK_LABEL, TRACKS, type TrackId } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TrackStats {
  pending: number;
  published: number;
  scored: number;
  shortlisted: number;
}

async function trackStats(track: TrackId): Promise<TrackStats> {
  const [{ count: pending }, { count: published }, { count: scored }, { count: shortlisted }] = await Promise.all([
    db()
      .from("runs")
      .select("*", { count: "exact", head: true })
      .eq("track", track)
      .in("status", ["outline_review", "draft_review", "failed"]),
    db().from("runs").select("*", { count: "exact", head: true }).eq("track", track).eq("status", "published"),
    db().from("feed_items").select("*", { count: "exact", head: true }).eq("track", track).eq("status", "scored"),
    db().from("feed_items").select("*", { count: "exact", head: true }).eq("track", track).eq("status", "shortlisted"),
  ]);
  return { pending: pending ?? 0, published: published ?? 0, scored: scored ?? 0, shortlisted: shortlisted ?? 0 };
}

const TRACK_DESC: Record<TrackId, string> = {
  wechat: "「AI 前沿观察」解读号 —— RSS + GitHub 热门库，二次创作长文",
  x: "@zynqorw 实测干货帖 —— 跨境金融教程 + GitHub 开源工具支线",
};

const TRACK_ACCENT: Record<TrackId, string> = {
  wechat: "border-green-600 hover:bg-green-50",
  x: "border-neutral-900 hover:bg-neutral-100",
};

export default async function Home() {
  // 平台选择首页：两个模块完全独立，从这里进入其一
  let stats: Record<TrackId, TrackStats> | null = null;
  let dbError: string | null = null;
  try {
    const [wechat, x] = await Promise.all([trackStats("wechat"), trackStats("x")]);
    stats = { wechat, x };
  } catch (e) {
    dbError = (e as Error).message;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-8">
      <div className="text-center">
        <h1 className="text-xl font-bold">选择平台</h1>
        <p className="mt-1 text-sm text-neutral-500">两条内容线完全独立：各自的选题池、内容源、产线和成稿</p>
      </div>

      {dbError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Supabase 连接失败：{dbError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {TRACKS.map((t) => (
          <Link
            key={t}
            href={`/${t}`}
            className={`block rounded-xl border-2 bg-white p-6 shadow-sm transition ${TRACK_ACCENT[t]}`}
          >
            <h2 className="text-lg font-bold">{TRACK_LABEL[t]}</h2>
            <p className="mt-1 min-h-10 text-xs text-neutral-500">{TRACK_DESC[t]}</p>
            {stats && (
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt className="text-xs text-neutral-400">等你处理</dt>
                  <dd className={`text-xl font-bold ${stats[t].pending > 0 ? "text-amber-600" : "text-neutral-900"}`}>
                    {stats[t].pending}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-400">选题待筛</dt>
                  <dd className="text-xl font-bold text-neutral-900">{stats[t].scored}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-400">已发布</dt>
                  <dd className="text-xl font-bold text-neutral-900">{stats[t].published}</dd>
                </div>
              </dl>
            )}
            <p className="mt-4 text-right text-sm font-medium text-blue-600">进入 →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
