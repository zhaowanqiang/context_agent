"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publishRunToSite, unpublishPost } from "@/app/actions/posts";

/** run 详情页（已发布状态）下方：终稿回流到个人站公开层 /posts */
export default function SitePublishPanel({
  runId,
  post,
}: {
  runId: string;
  post: { id: string; slug: string } | null;
}) {
  const [isPending, setIsPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();

  const act = async (fn: () => Promise<{ error?: string; message?: string }>) => {
    setIsPending(true);
    setNote(null);
    try {
      const r = await fn();
      setNote(r.error ?? r.message ?? null);
      if (!r.error) router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-neutral-900">个人站</span>
        {post ? (
          <>
            <a
              href={`/posts/${post.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-700 underline underline-offset-2 hover:text-amber-800"
            >
              已回流 · /posts/{post.slug} ↗
            </a>
            <button
              disabled={isPending}
              onClick={() => {
                if (!confirm("从个人站下架这篇？（不影响平台发布记录）")) return;
                act(() => unpublishPost(post.id));
              }}
              className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50"
            >
              下架
            </button>
          </>
        ) : (
          <button
            disabled={isPending}
            onClick={() => act(() => publishRunToSite(runId))}
            className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
          >
            {isPending ? "回流中…" : "回流到个人站 /posts"}
          </button>
        )}
        <span className="text-[11px] text-neutral-400">
          平台发布后把终稿同步到自己域名——内容资产留在自己手里
        </span>
      </div>
      {note && <p className="mt-2 text-[12px] text-neutral-500">{note}</p>}
    </div>
  );
}
