import { cardEligibility } from "@/data/card-eligibility";

// 卡片横向对比表：全部字段取自 data/card-eligibility.ts 的结构化数据，不掺主观。
// 返现 / 年费 / 绑微信支付宝这类信息目前不是结构化字段，为避免编造，
// 这里只对比能如实给出的维度；要加列先在 CardEligibility 类型里补真实字段。

const KYC_LABEL: Record<number, string> = { 1: "简单", 2: "中等", 3: "较繁", 4: "很繁", 5: "最折腾" };

/** 有实测来源的几张卡的横向对比，补足单卡详情看不到的全局视角 */
export default function ComparisonTable() {
  // 按 KYC 从易到难——访客一眼看到最好上手的
  const rows = [...cardEligibility].sort((a, b) => a.kyc_difficulty - b.kyc_difficulty);

  return (
    <section className="mt-14">
      <h2 className="text-xl font-bold tracking-tight text-neutral-900">一张表看全部</h2>
      <p className="mt-1.5 text-sm text-neutral-500">
        按能不能用大陆护照/身份证、KYC 难度横向对比。政策随时变，以官方为准。
      </p>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-neutral-200 shadow-sm">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-[13px] text-neutral-500">
              <th className="px-4 py-3 font-semibold">产品</th>
              <th className="px-4 py-3 font-semibold">KYC 难度</th>
              <th className="px-4 py-3 font-semibold">大陆护照/身份证</th>
              <th className="px-4 py-3 font-semibold">需海外地址</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((p) => (
              <tr key={p.id} className="bg-surface transition hover:bg-amber-50/40">
                <td className="px-4 py-3">
                  <a
                    href={`#card-${p.id}`}
                    className="font-semibold text-neutral-900 underline-offset-2 hover:text-amber-700 hover:underline"
                  >
                    {p.name}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className="tabular-nums text-neutral-600">{KYC_LABEL[p.kyc_difficulty] ?? p.kyc_difficulty}</span>
                </td>
                <td className="px-4 py-3">
                  {p.passport_ok.includes("mainland") ? (
                    <span className="font-medium text-emerald-700">✓ 可开</span>
                  ) : (
                    <span className="text-neutral-600">✗ 暂不可</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.requires_overseas_address ? (
                    <span className="text-amber-700">需要</span>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
