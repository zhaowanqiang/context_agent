import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { assembleMaterial, fetchSeedContent, type SeedContent } from "@/lib/material";
import type { FeedItem } from "@/lib/types";
import { isTrackId, TRACK_LABEL } from "@/lib/types";
import NewRunForm from "@/components/NewRunForm";

export const dynamic = "force-dynamic";

export default async function NewRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ feed_item?: string }>;
}) {
  const { track } = await params;
  if (!isTrackId(track)) notFound();
  const { feed_item } = await searchParams;

  // 从选题池带过来的种子：普通文章抓原文全文+配图；GitHub 库抓仓库档案+README
  let seed: FeedItem | null = null;
  let content: SeedContent | null = null;
  if (feed_item) {
    const { data } = await db().from("feed_items").select("*").eq("id", feed_item).single();
    seed = data as FeedItem | null;
    // 选题属于另一个轨道时纠正 URL（两个模块互不掺杂）
    if (seed && seed.track !== track) redirect(`/agent/${seed.track}/runs/new?feed_item=${feed_item}`);
    if (seed) content = await fetchSeedContent(seed.link);
  }

  const seedMaterial = seed
    ? assembleMaterial(
        seed,
        content,
        "（可选：你的判断、想强调的点、反对的地方；不填就纯按解读视角写）\n"
      )
    : "";

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-bold text-neutral-900">新建 Run · {TRACK_LABEL[track]}</h1>
      {seed && (
        <p className={`text-xs ${content ? "text-green-600" : "text-orange-600"}`}>
          {content
            ? content.kind === "github"
              ? `✓ 仓库档案 + README 已自动抓取（${content.text.length} 字），可直接创建`
              : `✓ 原文已自动抓取（${content.text.length} 字 · ${content.images.length} 张配图），可直接创建`
            : "⚠ 自动抓取失败，请手动把正文粘进【原文全文】"}
        </p>
      )}
      <NewRunForm track={track} seedMaterial={seedMaterial} feedItemId={seed?.id ?? null} />
    </div>
  );
}
