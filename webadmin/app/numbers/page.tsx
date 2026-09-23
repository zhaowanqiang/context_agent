import type { Metadata } from "next";
import NumbersSection from "@/components/phone-numbers/NumbersSection";
import { siteUrl, TG_GROUP_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "海外手机号",
  description: "海外手机号方案整理：获取方式、保号规则、能否接收海外平台验证码——没核实过的一律标「待核实」。",
  alternates: { canonical: `${siteUrl()}/numbers` },
};

/** 公开层：海外手机号。数据来自 data/phone-numbers.ts，改数据不用动组件 */
export default function NumbersPage() {
  return (
    <div className="py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
        海外手机号<span className="text-amber-500">.</span>
      </h1>
      <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-neutral-600">
        注册 X、Telegram、海外银行和交易所，常常卡在一个能长期收验证码的号码上。
        这里按获取方式、保号规则、能否接收海外平台验证码逐个整理——
        资费和保号规则变动频繁，没核实过的一律标「待核实」，不猜数字。
      </p>
      <p className="mt-2 text-[13px] text-neutral-500">
        有问题可以在{" "}
        <a
          href={TG_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-700 underline decoration-amber-300 underline-offset-4 hover:text-amber-800"
        >
          TG 交流群 ↗
        </a>{" "}
        里问。
      </p>

      <NumbersSection />
    </div>
  );
}
