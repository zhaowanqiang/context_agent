import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";
import { getPostBySlug } from "@/lib/posts";
import { SITE, siteUrl } from "@/lib/site";
import { TRACK_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

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
      <footer className="mt-14 rounded-xl bg-neutral-100/80 px-5 py-4 text-[13px] leading-relaxed text-neutral-500">
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
