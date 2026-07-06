import { addSource } from "@/app/actions/sources";
import { db } from "@/lib/supabase";
import type { Source } from "@/lib/types";
import SourceRowActions from "@/components/SourceRowActions";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const { data, error } = await db().from("sources").select("*").order("created_at");
  if (error) {
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">读取失败：{error.message}</div>;
  }
  const sources = (data ?? []) as Source[];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-semibold">RSS 源</h1>

      <ul className="divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
        {sources.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <span className={`h-2 w-2 shrink-0 rounded-full ${s.enabled ? "bg-green-500" : "bg-neutral-300"}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{s.name}</span>
              <span className="block truncate text-xs text-neutral-400">{s.feed_url}</span>
              {s.last_error && <span className="block truncate text-xs text-red-600">上次抓取失败：{s.last_error}</span>}
              {s.last_fetched_at && !s.last_error && (
                <span className="block text-xs text-neutral-400">
                  上次抓取：{new Date(s.last_fetched_at).toLocaleString("zh-CN")}
                </span>
              )}
            </span>
            <SourceRowActions id={s.id} enabled={s.enabled} />
          </li>
        ))}
        {sources.length === 0 && <li className="px-4 py-3 text-sm text-neutral-500">还没有源（执行 schema.sql 会预置 4 个）。</li>}
      </ul>

      <form action={addSource} className="space-y-2 rounded border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">添加源</h2>
        <div className="flex gap-2">
          <input name="name" required placeholder="名称" className="w-40 rounded border border-neutral-300 px-2 py-1.5 text-sm" />
          <input name="feed_url" required type="url" placeholder="https://…/feed" className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm" />
          <input type="hidden" name="track" value="wechat" />
          <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700">
            添加
          </button>
        </div>
        <p className="text-xs text-neutral-400">注意：新源先确认输出是 UTF-8 编码（国内老站偶有 GB2312，会乱码）。</p>
      </form>
    </div>
  );
}
