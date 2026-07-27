"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TRACK_LABEL, type TrackId } from "@/lib/types";

/** 列表所需的轻量字段（不含 content_md，正文不进浏览器 bundle） */
export interface PostCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  track: TrackId | null;
  published_at: string;
}

/** 公开层文章列表 + 关键词搜索 + 轨道筛选（纯客户端过滤，数据量小无需查库） */
export default function PostsList({ posts }: { posts: PostCard[] }) {
  const [q, setQ] = useState("");
  const [track, setTrack] = useState<TrackId | "all">("all");

  // 只显示实际存在的轨道 chip（当前全是公众号长文时不显示无用的 X chip）
  const tracks = useMemo(
    () => Array.from(new Set(posts.map((p) => p.track).filter((t): t is TrackId => Boolean(t)))),
    [posts]
  );

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return posts.filter((p) => {
      if (track !== "all" && p.track !== track) return false;
      if (!kw) return true;
      return (
        p.title.toLowerCase().includes(kw) ||
        (p.summary ?? "").toLowerCase().includes(kw)
      );
    });
  }, [posts, q, track]);

  return (
    <>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题 / 摘要…"
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[14px] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-amber-300 sm:max-w-xs"
        />
        {tracks.length > 1 && (
          <div className="flex shrink-0 gap-1.5">
            {(["all", ...tracks] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTrack(t)}
                className={[
                  "rounded-full px-3 py-1 text-[12.5px] transition",
                  track === t
                    ? "bg-amber-100 font-medium text-amber-800"
                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200",
                ].join(" ")}
              >
                {t === "all" ? "全部" : TRACK_LABEL[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-[13.5px] text-neutral-400">没有匹配的文章。</p>
      ) : (
        <ul className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <li key={p.id} className="h-full">
              <Link
                href={`/posts/${p.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2 text-[11.5px] text-neutral-400">
                  <time className="tabular-nums">
                    {new Date(p.published_at).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  </time>
                  {p.track && (
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-500">
                      {TRACK_LABEL[p.track]}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-[16px] font-semibold leading-snug text-neutral-900 transition group-hover:text-amber-700">
                  {p.title}
                </h2>
                {p.summary && (
                  <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-neutral-500">{p.summary}</p>
                )}
                <span className="mt-auto pt-4 text-[12.5px] font-medium text-amber-700 opacity-0 transition group-hover:opacity-100">
                  阅读 →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
