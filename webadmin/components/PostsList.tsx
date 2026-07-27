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

  const filtering = q.trim() !== "" || track !== "all";

  return (
    <>
      <div className="mt-8 flex flex-col gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题 / 摘要…"
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[14px] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-amber-300 sm:max-w-xs"
        />
        <div className="flex shrink-0 items-center gap-3">
          {/* 筛选中才报计数：没筛时标题行已经给过总数 */}
          {filtering && (
            <span className="font-mono text-[11.5px] tabular-nums text-neutral-400">
              {filtered.length} / {posts.length}
            </span>
          )}
          {tracks.length > 1 && (
            <div className="flex gap-1.5">
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
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-[13.5px] text-neutral-400">没有匹配的文章。</p>
      ) : (
        /* 列数按「网格自身宽度」定，不看视口（容器查询）：访客版心 64rem → 3 栏，
           登录版心 92.5rem → 4 栏，两种下每张卡都落在 320-360px 的舒适区。
           卡片观感与首页「最新文章」统一——同类内容不该有两套样子。 */
        <div className="@container mt-7">
        <ul className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
          {filtered.map((p) => (
            <li key={p.id} className="flex">
              <Link
                href={`/posts/${p.slug}`}
                className="group flex flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-amber-300 hover:shadow-[0_1px_16px_rgba(180,83,9,0.07)]"
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
                  <p className="mt-2 line-clamp-3 flex-1 text-[13px] leading-relaxed text-neutral-500">{p.summary}</p>
                )}
                {/* 常显而非 hover 才现：触屏没有 hover，藏起来等于没有 */}
                <p className="mt-4 text-[13px] font-medium text-amber-700">
                  读全文 <span className="inline-block transition group-hover:translate-x-0.5">→</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
        </div>
      )}
    </>
  );
}
