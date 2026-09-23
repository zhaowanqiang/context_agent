import Decider from "@/components/decider/Decider";
import AuthBar from "@/components/decider/AuthBar";
import ComparisonTable from "@/components/decider/ComparisonTable";
import Link from "next/link";
import { guides, formatVerified } from "@/data/decider/guides";
import { products } from "@/data/decider/products";

// 唯一主页 = 教程库面板 + 右侧答题推荐(原「价值主张 hero + 答题」漏斗页已废弃,用户拍板)。
// 教程只取元信息,付费正文(paidMd)绝不离开服务端。
const cards = Object.values(guides).map((g) => {
  const product = products.find((p) => p.id === g.id);
  return {
    id: g.id,
    productName: g.productName,
    title: g.title,
    free: g.paidMd === null,
    price: g.price_cny,
    listPrice: g.list_price_cny ?? null,
    pitch: product?.pitch ?? "",
    kyc: product?.kyc_difficulty ?? null,
    verifiedAt: g.verified_at,
  };
});

const KYC_LABEL: Record<number, string> = { 1: "KYC 简单", 2: "KYC 中等", 3: "KYC 较繁" };

function GuidesPanel() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        实测教程库
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
        每一篇都是本人实测走通后才写。不确定先开哪个?右边答 4 个问题,当场给出适合你的推荐顺序。
      </p>
      <p className="mt-2 text-xs text-slate-400">
        本人实测走通才写 · 开户走邀请码拿新人奖励 · 付费只卖「不知道就白做」的关键决定
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4">
        {cards.map((c) => (
          <Link
            key={c.id}
            href={`/decider/guide/${c.id}`}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-semibold text-slate-500">{c.productName}</p>
              <span
                className={[
                  "shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                  c.free ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800",
                ].join(" ")}
              >
                {c.free ? (
                  "全文免费"
                ) : (
                  <>
                    首发 ¥{c.price}
                    {c.listPrice && <del className="ml-1 font-normal opacity-50">¥{c.listPrice}</del>}
                  </>
                )}
              </span>
            </div>
            <h2 className="mt-2 text-[15.5px] font-bold leading-snug text-slate-900 transition group-hover:text-amber-800">
              {c.title}
            </h2>
            {c.pitch && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{c.pitch}</p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {c.kyc != null && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                    {KYC_LABEL[c.kyc] ?? ""}
                  </span>
                )}
                <span className="text-[11px] text-emerald-600" title="政策/费率随时变,标出核对时间">
                  ✓ {formatVerified(c.verifiedAt)}
                </span>
              </div>
              <span className="text-[13px] font-medium text-amber-700 opacity-0 transition group-hover:opacity-100">
                看教程 →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    /* 并入主站后不再自带 <main>/容器/品牌栏——外壳由主站 layout 提供，
       这里只留标题行与登录态 */
    <div className="py-4">
      <div className="mb-8 flex items-center justify-between gap-4 sm:mb-10">
        <p className="text-sm font-bold tracking-tight text-slate-900">
          🧭 出海开户决策
        </p>
        <AuthBar />
      </div>

      <Decider hero={<GuidesPanel />} />

      <ComparisonTable />

      {/* 免责与说明：原独立站的 footer，并入后降级为区块小字（页脚由主站提供）。
          「政策随时会变，以官方最新为准」这句是实测类内容的必要声明，不能丢 */}
      <div className="mt-16 space-y-1 border-t border-slate-200 pt-6 text-xs text-slate-400">
        <p>结论与开户链接永久免费；逐步实操 + 避坑清单按单篇一次性解锁，内容来自本人实测。</p>
        <p>
          产品政策（费率/返现/地区）随时会变，以官方最新为准。有问题找{" "}
          <a
            href="https://x.com/zynqorw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 underline underline-offset-2 hover:text-amber-700"
          >
            X @zynqorw ↗
          </a>
          。
        </p>
      </div>
    </div>
  );
}
