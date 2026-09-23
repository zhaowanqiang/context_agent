import type { Metadata } from "next";
import Link from "next/link";
import GuideGrid, { type GuideCard } from "@/components/guides/GuideGrid";
import { formatVerified, listGuides, type Guide } from "@/lib/guides";

// ISR：与 /posts 同策略（公网门面 60s 再验证，本机因 layout 读 cookie 退回逐请求）
export const revalidate = 60;

export const metadata: Metadata = {
  title: "教程",
  description: "海外账户、加密支付卡、AI 工具的保姆级实操教程——每一步都是我自己走过一遍写下来的。",
};

/** 公开层：教程库列表。与 /posts 的区别是这里按「最后核对时间」标新鲜度，
 *  不按发布日排流水——教程是会反复回来修的常青内容。 */
export default async function GuidesPage() {
  let guides: Guide[] = [];
  try {
    guides = await listGuides();
  } catch {
    /* 表未建 / 库不可达：展示空态，不 500 */
  }

  return (
    <div className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
            教程<span className="text-amber-500">.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-neutral-500">
            海外账户、加密支付卡、AI 工具的保姆级实操——每一步都是我自己走过一遍写下来的，
            带截图，标注最后核对时间。政策变了我会回来改。
          </p>
        </div>
        {guides.length > 0 && (
          <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-neutral-400">
            {guides.length} guides
          </p>
        )}
      </div>

      {guides.length === 0 ? (
        <p className="mt-16 text-center text-[13.5px] text-neutral-400">教程正在整理中。</p>
      ) : (
        <>
          <GuideGrid guides={guides.map(toCard)} />
          {/* 教程读完想直接开通的走这里；返佣披露挂在 /deals 页上 */}
          <p className="mt-10 text-center text-[12.5px] text-neutral-400">
            只想拿开通链接和邀请码？
            <Link href="/deals" className="ml-1 font-medium text-amber-700 hover:underline">
              看全部推荐 →
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

/** Guide → 列表卡片：content_md 这类大字段不下发到客户端 */
function toCard(g: Guide): GuideCard {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    summary: g.summary,
    coverUrl: g.cover_url,
    verifiedLabel: g.verified_at ? formatVerified(g.verified_at) : null,
    category: g.category,
  };
}
