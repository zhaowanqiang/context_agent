import { db } from "@/lib/supabase";
import type { FeedItem, FeedItemStatus } from "@/lib/types";
import TopicToolbar from "@/components/TopicToolbar";
import TopicRowActions from "@/components/TopicRowActions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_TAB: { key: FeedItemStatus | "all"; label: string }[] = [
  { key: "scored", label: "已打分" },
  { key: "shortlisted", label: "候选" },
  { key: "new", label: "未打分" },
  { key: "used", label: "已用" },
  { key: "discarded", label: "已丢弃" },
];

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: FeedItemStatus; track?: "x" | "wechat" }>;
}) {
  const { status = "scored", track } = await searchParams;

  let q = db()
    .from("feed_items")
    .select("*")
    .eq("status", status)
    .limit(100);
  if (track) q = q.eq("track", track);
  q = status === "scored" ? q.order("score", { ascending: false }) : q.order("fetched_at", { ascending: false });
  const { data, error } = await q;
  if (error) {
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">读取失败：{error.message}</div>;
  }
  const items = (data ?? []) as FeedItem[];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="font-semibold">选题池（公众号轨道）</h1>
        <TopicToolbar />
      </div>

      <div className="flex items-center gap-2">
        {STATUS_TAB.map((t) => (
          <Link
            key={t.key}
            href={`/topics?status=${t.key}${track ? `&track=${track}` : ""}`}
            className={`rounded px-2 py-1 text-xs ${
              status === t.key
                ? "bg-neutral-900 text-white"
                : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <span className="mx-1 text-neutral-300">|</span>
        {([
          { key: undefined, label: "全部轨道" },
          { key: "wechat", label: "公众号" },
          { key: "x", label: "X" },
        ] as const).map((t) => (
          <Link
            key={t.label}
            href={`/topics?status=${status}${t.key ? `&track=${t.key}` : ""}`}
            className={`rounded px-2 py-1 text-xs ${
              track === t.key
                ? "bg-blue-700 text-white"
                : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">这个状态下没有条目。先点「抓取全部源」，再点「AI 打分」。</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-3 px-4 py-3">
              {it.score !== null && (
                <span
                  className={`mt-0.5 w-10 shrink-0 text-center text-sm font-bold ${
                    it.score >= 7 ? "text-green-600" : it.score >= 4 ? "text-amber-600" : "text-neutral-400"
                  }`}
                >
                  {Number(it.score).toFixed(1)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <a href={it.link} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline">
                  {it.title}
                </a>
                {it.suggested_angle && (
                  <span className="block truncate text-xs text-blue-700">角度：{it.suggested_angle}</span>
                )}
                {it.score_reason && (
                  <span className="block truncate text-xs text-neutral-400">{it.score_reason}</span>
                )}
              </span>
              <TopicRowActions id={it.id} status={it.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
