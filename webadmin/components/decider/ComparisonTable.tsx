import Link from "next/link";
import { products } from "@/data/decider/products";
import { guides } from "@/data/decider/guides";

// 产品横向对比表:全部字段取自 products.ts 的结构化数据,不掺主观。
// 返现/年费/绑微信支付宝这类信息目前不是结构化字段(只散落在各篇教程正文里),
// 为避免编造,这里只对比能如实给出的维度;要加列先在 Product 类型里补真实字段。

const KYC_LABEL: Record<number, string> = { 1: "简单", 2: "中等", 3: "较繁", 4: "很繁", 5: "最折腾" };

function typeLabel(tags: string[]): string {
  const card = tags.includes("card");
  const broker = tags.includes("broker");
  if (card && broker) return "账户 + 卡";
  if (broker) return "券商";
  return "支付卡";
}

/** 卡片全列的横向对比,补足"答题漏斗 / 单卡教程"看不到的全局视角 */
export default function ComparisonTable() {
  // 先卡后券商,组内按 KYC 从易到难——访客一眼看到最好上手的
  const rows = [...products].sort((a, b) => {
    const ac = a.tags.includes("card") ? 0 : 1;
    const bc = b.tags.includes("card") ? 0 : 1;
    return ac - bc || a.kyc_difficulty - b.kyc_difficulty;
  });

  return (
    <section className="mt-14">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">一张表看全部</h2>
      <p className="mt-1.5 text-sm text-slate-500">
        按能不能用大陆护照/身份证、KYC 难度横向对比。政策随时变,以官方与各篇教程的核对时间为准。
      </p>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[13px] text-slate-500">
              <th className="px-4 py-3 font-semibold">产品</th>
              <th className="px-4 py-3 font-semibold">类型</th>
              <th className="px-4 py-3 font-semibold">KYC 难度</th>
              <th className="px-4 py-3 font-semibold">大陆护照/身份证</th>
              <th className="px-4 py-3 font-semibold">需海外地址</th>
              <th className="px-4 py-3 font-semibold">教程</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => {
              const hasGuide = Boolean(guides[p.id]);
              const mainlandOk = p.passport_ok.includes("mainland");
              return (
                <tr key={p.id} className="bg-white transition hover:bg-amber-50/40">
                  <td className="px-4 py-3">
                    {hasGuide ? (
                      <Link href={`/decider/guide/${p.id}`} className="font-semibold text-slate-900 underline-offset-2 hover:text-amber-700 hover:underline">
                        {p.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-slate-900">{p.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{typeLabel(p.tags)}</td>
                  <td className="px-4 py-3">
                    <span className="tabular-nums text-slate-600">
                      {KYC_LABEL[p.kyc_difficulty] ?? p.kyc_difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {mainlandOk ? (
                      <span className="font-medium text-emerald-600">✓ 可开</span>
                    ) : (
                      <span className="text-slate-400">✗ 暂不可</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.requires_overseas_address ? (
                      <span className="text-amber-700">需要</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {hasGuide ? (
                      <Link href={`/decider/guide/${p.id}`} className="text-[13px] font-medium text-amber-700 hover:underline">
                        {guides[p.id].paidMd === null ? "免费全文 →" : "看教程 →"}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-slate-400">暂无</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
