import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuideById } from "@/lib/guides";
import { renderMarkdown } from "@/lib/markdown";
import GuideEditor from "@/components/GuideEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "编辑教程" };

interface Props {
  params: Promise<{ id: string }>;
}

/** 私有层：教程编辑 + 配图上传 + 上站把关 */
export default async function EditGuidePage({ params }: Props) {
  const { id } = await params;
  const guide = await getGuideById(id).catch(() => null);
  if (!guide) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <Link href="/import" className="text-[12.5px] text-neutral-400 hover:text-amber-700">
          ← 教程导入
        </Link>
        <span className="font-mono text-[11px] text-neutral-400">/guides/{guide.slug}</span>
      </div>

      <GuideEditor guide={guide} />

      {/* 预览用的是已保存的正文（服务端渲染同一个 renderMarkdown），
          所以看到的就是访客会看到的——改完先保存再看这里 */}
      <section>
        <h2 className="text-[13px] font-semibold text-neutral-700">
          预览 <span className="font-normal text-neutral-400">· 已保存的内容</span>
        </h2>
        <div
          className="md-body md-article mt-2 rounded-lg border border-neutral-200 bg-white px-6 py-5"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(guide.content_md) }}
        />
      </section>
    </div>
  );
}
