import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";
import { adjacentPosts, getPostBySlug } from "@/lib/posts";
import { SITE, siteUrl } from "@/lib/site";
import { TRACK_LABEL } from "@/lib/types";

// ISR：公网门面实例 60s 再验证（访客秒开、Supabase 波动不伤站点）；
// 本机实例 layout 读 cookie 自动退回逐请求渲染，行为不变
export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary ?? undefined,
    alternates: { canonical: `${siteUrl()}/posts/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary ?? undefined,
      url: `${siteUrl()}/posts/${post.slug}`,
      publishedTime: post.published_at,
      authors: [SITE.author],
    },
  };
}

/** 中文按字算：400 字/分钟，下限 1 分钟 */
function readingMinutes(md: string): number {
  return Math.max(1, Math.round(md.replace(/\s/g, "").length / 400));
}

/** 公开层：文章详情——阅读版式（.md-article 放大字号行距） */
export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  if (!post) notFound();
  const { prev, next } = await adjacentPosts(post.published_at).catch(() => ({ prev: null, next: null }));

  return (
    <article className="mx-auto max-w-2xl py-10">
      <Link href="/posts" className="text-[12.5px] text-neutral-400 transition hover:text-amber-700">
        ← 全部文章
      </Link>
      <h1 className="mt-5 text-[27px] font-bold leading-[1.45] tracking-tight text-neutral-900 sm:text-[30px]">
        {post.title}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-neutral-400">
        <span className="font-medium text-neutral-500">{SITE.author}</span>
        <span aria-hidden>·</span>
        <time>{new Date(post.published_at).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</time>
        <span aria-hidden>·</span>
        <span>约 {readingMinutes(post.content_md)} 分钟</span>
        {post.track && (
          <>
            <span aria-hidden>·</span>
            <span>{TRACK_LABEL[post.track]}</span>
          </>
        )}
      </div>
      <div
        className="md-body md-article mt-9 border-t border-neutral-200 pt-9"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content_md) }}
      />
      {/* 文末转化区：流量的终点是转化的起点——按轨道切换推广位 */}
      {post.track === "x" ? (
        <a
          href="https://decider.zynqorw.com"
          className="group mt-10 block rounded-xl border border-amber-200/80 bg-amber-50/60 px-5 py-4 transition hover:border-amber-300 hover:bg-amber-50"
        >
          <p className="text-[14.5px] font-bold text-neutral-900">
            🧭 想开海外账户 / U 卡？我把实测教程都整理好了
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
            Wise / KAST / Bybit Card 等 5 篇保姆级实操，2 篇全文免费——答 4 个问题还能拿个性化开户推荐。
            <span className="ml-1 font-medium text-amber-700 opacity-0 transition group-hover:opacity-100">去看看 →</span>
          </p>
        </a>
      ) : (
        <div className="mt-10 rounded-xl border border-amber-200/80 bg-amber-50/60 px-5 py-4">
          <p className="text-[14.5px] font-bold text-neutral-900">觉得有用？我每周都在写</p>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
            AI 工具与效率实测、跨境金融干货——关注{" "}
            <a href="https://x.com/zynqorw" target="_blank" rel="noreferrer" className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-4">
              X @zynqorw
            </a>
            {" "}或订阅{" "}
            <a href="/rss.xml" className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-4">
              RSS
            </a>
            ，不错过下一篇。
          </p>
        </div>
      )}

      {/* 上一篇 / 下一篇：把访客留在站内 */}
      {(prev || next) && (
        <nav className="mt-6 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link href={`/posts/${prev.slug}`} className="group rounded-xl border border-neutral-200 bg-white px-4 py-3 transition hover:border-amber-300">
              <span className="text-[11px] text-neutral-400">← 上一篇</span>
              <span className="mt-0.5 block truncate text-[13.5px] font-medium text-neutral-700 group-hover:text-amber-700">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/posts/${next.slug}`} className="group rounded-xl border border-neutral-200 bg-white px-4 py-3 text-right transition hover:border-amber-300">
              <span className="text-[11px] text-neutral-400">下一篇 →</span>
              <span className="mt-0.5 block truncate text-[13.5px] font-medium text-neutral-700 group-hover:text-amber-700">
                {next.title}
              </span>
            </Link>
          )}
        </nav>
      )}

      <footer className="mt-8 rounded-xl bg-neutral-100/80 px-5 py-4 text-[13px] leading-relaxed text-neutral-500">
        本文出自我的 AI 产线，经人工核对后发布；同步发布于{" "}
        {SITE.links.map((l, i) => (
          <span key={l.href}>
            {i > 0 && " / "}
            <a href={l.href} target="_blank" rel="noreferrer" className="text-amber-700 underline decoration-amber-300 underline-offset-4">
              {l.label}
            </a>
          </span>
        ))}
        。转载请注明出处。
      </footer>
    </article>
  );
}
