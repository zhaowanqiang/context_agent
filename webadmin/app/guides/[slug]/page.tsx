import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import GuideBody from "@/components/referral/GuideBody";
import ReferralCard from "@/components/referral/ReferralCard";
import {
  getReferral,
  isActive,
  REFERRAL_DISCLOSURE,
  withLiveGuide,
  type Referral,
} from "@/data/referrals";
import { referencedReferralIds } from "@/lib/guideBlocks";
import { formatVerified, getGuideBySlug, publishedGuideSlugs } from "@/lib/guides";
import { SITE, siteUrl } from "@/lib/site";

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug).catch(() => null);
  if (!guide || guide.status !== "published") return {};
  return {
    title: guide.title,
    description: guide.summary ?? undefined,
    alternates: { canonical: `${siteUrl()}/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.summary ?? undefined,
      url: `${siteUrl()}/guides/${guide.slug}`,
      images: guide.cover_url ? [guide.cover_url] : undefined,
      authors: [SITE.author],
    },
  };
}

/** 公开层：教程详情。草稿走 notFound——未把关的内容不能因为知道 slug 就看得到 */
export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug).catch(() => null);
  if (!guide || guide.status !== "published") notFound();

  // 文末主推位。去掉正文里已经内嵌过的——同一张卡上下出现两遍，
  // 观感像模板出了 bug，转化也不会因为重复而变高。
  const inlined = new Set(referencedReferralIds(guide.content_md));
  const footer = guide.referral_ids
    .filter((id) => !inlined.has(id))
    .map(getReferral)
    .filter((r): r is Referral => r !== undefined && isActive(r));
  const live = footer.length > 0 ? await publishedGuideSlugs() : new Set<string>();

  // 披露只在真有返佣位时出——没有返佣的教程挂一句"本页含返佣链接"是假的
  const hasReferral = footer.length > 0 || [...inlined].some((id) => {
    const r = getReferral(id);
    return r !== undefined && isActive(r);
  });

  return (
    <article className="mx-auto max-w-2xl py-10">
      <Link href="/guides" className="text-[12.5px] text-neutral-400 transition hover:text-amber-700">
        ← 全部教程
      </Link>
      <h1 className="mt-5 text-[27px] font-bold leading-[1.45] tracking-tight text-neutral-900 sm:text-[30px]">
        {guide.title}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-neutral-400">
        <span className="font-medium text-neutral-500">{SITE.author}</span>
        {guide.verified_at && (
          <>
            <span aria-hidden>·</span>
            {/* 核对时间放在最显眼处：跨境开户政策随时变，这是访客最该先看到的一条 */}
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
              {formatVerified(guide.verified_at)}
            </span>
          </>
        )}
      </div>

      {/* 正文里的 ::referral{} 标记会渲染成返佣卡，所以不能走
          dangerouslySetInnerHTML 一把梭——卡片带 onClick 埋点，是组件不是 HTML */}
      <div className="mt-9 border-t border-neutral-200 pt-9">
        <GuideBody markdown={guide.content_md} />
      </div>

      {footer.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            照着这篇开通
          </h2>
          <div className="mt-2">
            {footer.map((r) => (
              <ReferralCard key={r.id} referral={withLiveGuide(r, live)} from="guide_footer" />
            ))}
          </div>
        </section>
      )}

      {hasReferral && (
        <p className="mt-6 rounded-lg bg-neutral-100/70 px-4 py-3 text-[12px] leading-relaxed text-neutral-500">
          {REFERRAL_DISCLOSURE}
        </p>
      )}

      {/* 文末转化：免费教程的去处是 decider 的付费深度版 */}
      <Link
        href="/decider"
        className="group mt-12 block rounded-xl border border-amber-200/80 bg-amber-50/60 px-5 py-4 transition hover:border-amber-300 hover:bg-amber-50"
      >
        <p className="text-[14.5px] font-bold text-neutral-900">
          🧭 不确定自己该开哪个？
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
          答 4 个问题，按你的身份和需求给出可开清单与推荐顺序；教程库里还有逐张卡的实测流程。
          <span className="ml-1 font-medium text-amber-700 opacity-0 transition group-hover:opacity-100">
            去测一测 →
          </span>
        </p>
      </Link>
    </article>
  );
}
