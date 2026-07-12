import type { Metadata } from "next";
import Link from "next/link";
import { addClip } from "@/app/actions/clips";
import { db } from "@/lib/supabase";
import type { Clip } from "@/lib/types";
import { TRACK_LABEL } from "@/lib/types";
import ClipRowActions from "@/components/ClipRowActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "剪藏" };

/* 剪藏收件箱：平时刷到的素材随手存——第三条选题来源
   （RSS 抓取、监控简报之外）。转素材 = 跳新建 Run 预填（有链接自动抓原文）。 */

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 30);
  }
}

export default async function ClipsPage() {
  let clips: Clip[] = [];
  let dbError: string | null = null;
  try {
    const { data, error } = await db()
      .from("clips")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    clips = (data ?? []) as Clip[];
  } catch (e) {
    dbError = (e as Error).message;
  }
  const inbox = clips.filter((c) => c.status === "new");
  const archived = clips.filter((c) => c.status !== "new");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">剪藏收件箱</h1>
        <p className="mt-1 text-[12.5px] text-neutral-400">
          刷到好素材随手丢进来（手机同一 Wi-Fi 也能存），想写的时候一键转素材开 Run。
        </p>
      </div>

      {dbError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          读取失败：{dbError}（若表不存在，先在 Supabase SQL Editor 执行 schema.sql 里 2026-07-12 增量段）
        </p>
      )}

      {/* 入库表单 */}
      <form action={addClip} className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            name="url"
            placeholder="链接（可选）"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none transition focus:border-amber-500"
          />
          <select
            name="track"
            defaultValue=""
            className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-600 outline-none"
          >
            <option value="">轨道待定</option>
            <option value="wechat">公众号</option>
            <option value="x">X</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            name="note"
            placeholder="一句话备注 / 或直接粘一段文字素材"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none transition focus:border-amber-500"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-700"
          >
            存入
          </button>
        </div>
      </form>

      {/* 收件箱 */}
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          收件箱（{inbox.length}）
        </h2>
        {inbox.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 py-8 text-center text-[13px] text-neutral-400">
            空的——刷到好东西丢进来。
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white shadow-sm">
            {inbox.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-neutral-800">
                    {c.note?.split("\n")[0] || c.url}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-neutral-400">
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noreferrer" className="underline decoration-neutral-300 underline-offset-2 hover:text-amber-700">
                        {hostOf(c.url)} ↗
                      </a>
                    )}
                    {c.track && <span>{TRACK_LABEL[c.track]}</span>}
                    <span>{new Date(c.created_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span>
                  </span>
                </span>
                <ClipRowActions id={c.id} status={c.status} track={c.track} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 已处理 */}
      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            已处理（{archived.length}）
          </h2>
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white shadow-sm">
            {archived.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-500">
                  {c.note?.split("\n")[0] || c.url}
                </span>
                {c.status === "used" && c.used_run_id ? (
                  <Link
                    href={`/agent/${c.track ?? "wechat"}/runs/${c.used_run_id}`}
                    className="text-[12px] text-amber-700 underline decoration-amber-300 underline-offset-2"
                  >
                    已转素材 →
                  </Link>
                ) : (
                  <span className="text-[11.5px] text-neutral-300">{c.status === "used" ? "已用" : "已丢弃"}</span>
                )}
                <ClipRowActions id={c.id} status={c.status} track={c.track} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
