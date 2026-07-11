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

/** 公开层：文章详情（markdown → .md-body，与工作台预览同一套排版） */
export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl py-8">
      <Link href="/posts" className="text-xs text-neutral-400 hover:text-neutral-600">
        ← 全部文章
      </Link>
      <h1 className="mt-3 text-2xl font-bold leading-snug tracking-tight text-neutral-900">{post.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-400">
        <time>{new Date(post.published_at).toLocaleDateString("zh-CN")}</time>
        {post.track && (
          <>
            <span>·</span>
            <span>{TRACK_LABEL[post.track]}</span>
          </>
        )}
        <span>·</span>
        <span>{SITE.author}</span>
      </div>
      <div
        className="md-body mt-8 border-t border-neutral-200 pt-8"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content_md) }}
      />
      <footer className="mt-12 border-t border-neutral-200 pt-6 text-[13px] text-neutral-500">
        同步发布于{" "}
        {SITE.links.map((l, i) => (
          <span key={l.href}>
            {i > 0 && " / "}
            <a href={l.href} target="_blank" rel="noreferrer" className="text-amber-700 underline underline-offset-2">
              {l.label}
            </a>
          </span>
        ))}
        ，转载请注明出处。
      </footer>
    </article>
  );
}
