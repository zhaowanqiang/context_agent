import type { Metadata } from "next";
import Link from "next/link";
import ReferralCard from "@/components/referral/ReferralCard";
import {
  activeReferrals,
  REFERRAL_CATEGORIES,
  REFERRAL_DISCLOSURE,
  withLiveGuide,
} from "@/data/referrals";
import { publishedGuideSlugs } from "@/lib/guides";
import { siteUrl } from "@/lib/site";

// 产品是静态数据（data/referrals.ts），但「看教程」要查哪些教程已上站——与 /guides 同步 60s 再验证
export const revalidate = 60;

export const metadata: Metadata = {
  title: "我在用的",
  description:
    "我自己长期在用的账户、卡、服务器和 eSIM，附开通链接与邀请码。每一条都有对应的实测教程。",
  alternates: { canonical: `${siteUrl()}/deals` },
};

/**
 * 公开层：返佣产品汇总页。
 *
 * 存在的理由是「已经被教程说服、只想拿链接」的那批人——他们此前得回到
 * 某篇教程里去翻链接。顺带这一页也是返佣披露的正式落点。
 *
 * 页面只渲染 activeReferrals()：链接和邀请码都没有的条目（注册表里的 TODO 占位）
 * 不会露出，所以这页永远不会出现点了没反应的按钮。
 */
export default async function DealsPage() {
  const live = await publishedGuideSlugs();
  const grouped = REFERRAL_CATEGORIES.map((c) => ({
    meta: c,
    items: activeReferrals(c.id).map((r) => withLiveGuide(r, live)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
        我在用的<span className="text-amber-500">.</span>
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-neutral-500">
        下面每一条都是我自己长期在用、并且写过实测教程的。想看怎么开、会踩什么坑，
        点卡片上的「看教程」；只想拿链接就直接点开通。
      </p>

      {grouped.length === 0 ? (
        <p className="mt-16 text-center text-[13.5px] text-neutral-400">还没有可推荐的条目。</p>
      ) : (
        grouped.map((g) => (
          <section key={g.meta.id} className="mt-10">
            <h2 className="text-[15px] font-semibold text-neutral-900">{g.meta.label}</h2>
            <p className="mt-1 text-[12.5px] text-neutral-400">{g.meta.blurb}</p>
            <div className="mt-1">
              {g.items.map((r) => (
                <ReferralCard key={r.id} referral={r} from="deals" />
              ))}
            </div>
          </section>
        ))
      )}

      <p className="mt-12 rounded-lg bg-neutral-100/70 px-4 py-3 text-[12px] leading-relaxed text-neutral-500">
        {REFERRAL_DISCLOSURE}
      </p>

      <p className="mt-6 text-center text-[12.5px] text-neutral-400">
        不确定自己该开哪个？
        <Link href="/decider" className="ml-1 font-medium text-amber-700 hover:underline">
          答 4 个问题拿推荐 →
        </Link>
      </p>
    </div>
  );
}
