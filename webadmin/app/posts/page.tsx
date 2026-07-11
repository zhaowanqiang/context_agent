import type { Metadata } from "next";
import Link from "next/link";
import { listPosts, type Post } from "@/lib/posts";
import { TRACK_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "文章",
  description: "跨境金融 / 加密支付卡实测、AI 工具与效率实测——产线成稿回流的公开存档。",
};

/** 公开层：文章列表（posts 表未建时降级为空态，不 500） */
export default async function PostsPage() {
  let posts: Post[] = [];
  try {
    posts = await listPosts();
  } catch {
    /* 表未建 / 库不可达：展示空态 */
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
        文章<span className="text-amber-500">.</span>
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-neutral-500">
        实测干货的公开存档——同步发布于公众号与 X，原文以这里为准。
        也可以用 <a href="/rss.xml" className="text-amber-700 underline decoration-amber-300 underline-offset-4">RSS</a> 订阅。
      </p>

      {posts.length === 0 ? (
        <p className="mt-16 text-center text-[13.5px] text-neutral-400">
          还没有文章——第一篇正在产线上。
        </p>
      ) : (
        <ul className="mt-10 divide-y divide-neutral-200/70 border-t border-neutral-200">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/posts/${p.slug}`} className="group grid gap-x-5 py-6 sm:grid-cols-[92px_1fr]">
                <time className="pt-0.5 text-[12.5px] tabular-nums text-neutral-400">
                  {new Date(p.published_at).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })}
                </time>
                <div className="min-w-0">
                  <h2 className="text-[17px] font-semibold leading-snug text-neutral-900 transition group-hover:text-amber-700">
                    {p.title}
                  </h2>
                  {p.summary && (
                    <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-neutral-500">{p.summary}</p>
                  )}
                  {p.track && (
                    <p className="mt-2.5 text-[11.5px] text-neutral-400">{TRACK_LABEL[p.track]}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
