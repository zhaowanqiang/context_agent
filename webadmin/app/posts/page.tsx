import type { Metadata } from "next";
import { listPosts, type Post } from "@/lib/posts";
import PostsList from "@/components/PostsList";

// ISR：公网实例 60s 再验证；本机因 layout 读 cookie 自动退回逐请求渲染
export const revalidate = 60;

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
    <div className="py-10">
      {/* 标题行左右分栏：右侧存档计数承接宽容器下的头部留白 */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
            文章<span className="text-amber-500">.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-neutral-500">
            实测干货的公开存档——同步发布于公众号与 X，原文以这里为准。
            也可以用 <a href="/rss.xml" className="text-amber-700 underline decoration-amber-300 underline-offset-4">RSS</a> 订阅。
          </p>
        </div>
        {posts.length > 0 && (
          <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-neutral-400">
            {posts.length} posts archived
          </p>
        )}
      </div>

      {posts.length === 0 ? (
        <p className="mt-16 text-center text-[13.5px] text-neutral-400">
          还没有文章——第一篇正在产线上。
        </p>
      ) : (
        <PostsList
          posts={posts.map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            summary: p.summary,
            track: p.track,
            published_at: p.published_at,
          }))}
        />
      )}
    </div>
  );
}
