import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import type { Run, RunStatus } from "@/lib/types";
import { isTrackId, TRACK_LABEL } from "@/lib/types";
import RunStatusBadge from "@/components/RunStatusBadge";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  params,
  searchParams,
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ status?: RunStatus }>;
}) {
  const { track } = await params;
  if (!isTrackId(track)) notFound();
  const { status } = await searchParams;

  let q = db().from("runs").select("*").eq("track", track).order("created_at", { ascending: false }).limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) {
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">读取失败：{error.message}</div>;
  }
  const runs = (data ?? []) as Run[];

  const filter = (label: string, href: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`rounded px-2 py-1 text-xs ${active ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 text-xl font-bold text-neutral-900">Runs · {TRACK_LABEL[track]}</h1>
        {filter("全部", `/agent/${track}/runs`, !status)}
        {filter("待处理", `/agent/${track}/runs?status=draft_review`, status === "draft_review")}
        {filter("已发布", `/agent/${track}/runs?status=published`, status === "published")}
      </div>

      {runs.length === 0 ? (
        <p className="text-sm text-neutral-500">没有匹配的记录。</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
          {runs.map((r) => (
            <li key={r.id}>
              <Link href={`/agent/${track}/runs/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                <span className="flex-1 truncate text-sm">{r.title ?? r.material.slice(0, 40)}</span>
                <span className="text-xs text-neutral-400">
                  {new Date(r.created_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <RunStatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
