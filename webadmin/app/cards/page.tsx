import type { Metadata } from "next";
import Link from "next/link";
import CryptoCardsSection from "@/components/crypto-cards/CryptoCardsSection";
import ComparisonTable from "@/components/decider/ComparisonTable";
import { cards } from "@/data/crypto-cards";

export const metadata: Metadata = {
  title: "加密卡片",
  description:
    "加密支付卡实测：KAST、Bybit Card、Plasma One 的开户决策与申请教程，附邀请码。个人实测记录，不构成投资建议。",
};

// 纯静态数据（crypto-cards.ts），没有 DB 往返，交给默认的静态渲染即可
export default function CardsPage() {
  return (
    <div className="px-4 py-10 sm:px-6">
      <CryptoCardsSection />

      {/* 对比表复用 /decider 那张，不另建一套：口径、字段和「不编造」的原则都一致 */}
      <div className="decider-scope mx-auto max-w-[1200px]">
        <ComparisonTable only={cards.map((c) => c.slug)} />
      </div>

      <div className="mx-auto mt-10 max-w-[1200px]">
        <Link
          href="/decider"
          className="inline-block rounded-lg border border-neutral-300 px-4 py-2.5 text-[13px] font-medium text-neutral-700 transition hover:border-amber-400 hover:text-amber-800"
        >
          还要开券商或多币种账户？去出海开户决策 →
        </Link>
      </div>
    </div>
  );
}
