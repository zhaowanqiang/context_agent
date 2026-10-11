import type { Metadata } from "next";
import Link from "next/link";
import CryptoCardsSection from "@/components/crypto-cards/CryptoCardsSection";
import ComparisonTable from "@/components/crypto-cards/ComparisonTable";
import { siteUrl } from "@/lib/site";
import { cardTutorialLinks } from "@/lib/tutorials";

export const metadata: Metadata = {
  title: "加密卡片",
  description:
    "加密支付卡实测：KAST、Bybit Card、Plasma One 的开户决策与申请教程，附邀请码。个人实测记录，不构成投资建议。",
  alternates: { canonical: `${siteUrl()}/cards` },
};

// 纯静态数据（crypto-cards.ts），没有 DB 往返，交给默认的静态渲染即可
export default function CardsPage() {
  return (
    <div className="px-4 py-10 sm:px-6">
      <CryptoCardsSection tutorialLinks={cardTutorialLinks()} />

      <div className="mx-auto max-w-[1200px]">
        <ComparisonTable />
      </div>

      <div className="mx-auto mt-10 max-w-[1200px]">
        <Link
          href="/tutorials"
          className="inline-block rounded-lg border border-neutral-300 px-4 py-2.5 text-[13px] font-medium text-neutral-700 transition hover:border-amber-400 hover:text-amber-800"
        >
          还要开券商、交易所或多币种账户？去教程导航 →
        </Link>
      </div>
    </div>
  );
}
