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
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900">文章</h1>
      <p className="mt-2 text-[14px] text-neutral-500">
        实测干货的公开存档——同步发布于公众号与 X，原文以这里为准。
      </p>

      {posts.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-neutral-200 p-8 text-center text-[13px] text-neutral-400">
          还没有文章。工作台里发布 run 后点「回流到个人站」即可上架。
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-neutral-200">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/posts/${p.slug}`} className="group block py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="min-w-0 flex-1 truncate text-[16px] font-bold text-neutral-900 transition group-hover:text-amber-700">
                    {p.title}
                  </h2>
                  <time className="shrink-0 text-[12px] text-neutral-400">
                    {new Date(p.published_at).toLocaleDateString("zh-CN")}
                  </time>
                </div>
                {p.summary && (
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-neutral-500">{p.summary}</p>
                )}
                {p.track && (
                  <span className="mt-2 inline-block rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-400">
                    {TRACK_LABEL[p.track]}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
