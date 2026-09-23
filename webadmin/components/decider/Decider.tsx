"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  Answers,
  Goal,
  KycTolerance,
  PassportType,
  ScoredProduct,
} from "@/lib/decider/types";
import { getRecommendations } from "@/lib/decider/match";
import { track } from "@/lib/track";

const passportOptions: { value: PassportType; label: string }[] = [
  { value: "mainland", label: "大陆护照" },
  { value: "hk_macau_permit", label: "港澳通行证" },
  { value: "overseas", label: "已有海外身份" },
];

const goalOptions: { value: Goal; label: string }[] = [
  { value: "broker", label: "美股券商" },
  { value: "crypto", label: "加密出入金" },
  { value: "card", label: "实体消费卡" },
];

const kycOptions: { value: KycTolerance; label: string }[] = [
  { value: "easy_only", label: "只要简单的" },
  { value: "willing", label: "愿意折腾换更强功能" },
];

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        // 手机端:加大点击区(min 44px 高、上下内距更足);桌面端 sm: 还原原样式
        "inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2.5 text-sm font-medium transition sm:min-h-0 sm:py-2",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Question({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">
        <span className="mr-2 text-slate-400">{step}.</span>
        {title}
      </h3>
      <div className="flex flex-wrap gap-3 sm:gap-2">{children}</div>
    </div>
  );
}

function ResultCard({ item }: { item: ScoredProduct }) {
  const { product, reasons } = item;
  const price = product.paid_price_cny ?? 29;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h4 className="min-w-0 break-words text-base font-semibold text-slate-900">
          {product.name}
        </h4>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
          匹配分 {item.score}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-700">{product.pitch}</p>

      {reasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {reasons.map((r) => (
            <span
              key={r}
              className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
            >
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500">主要的坑(标题)</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
          {product.free_pitfalls.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      {/* 主动线:点推荐 → 看我的教程(阅读视图);referral 开户是并行转化位。mt-auto 让双列网格里按钮对齐卡底 */}
      <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
        {(product.has_paid_guide || product.has_free_guide) && (
          <Link
            href={`/decider/guide/${product.id}`}
            className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-slate-700"
          >
            📖 看开卡教程
            {product.has_free_guide ? "(全文免费)" : `(第一步免费 · 完整版首发 ¥${price})`}
          </Link>
        )}
        {product.referral_url ? (
          <a
            href={product.referral_url}
            target="_blank"
            rel="noopener noreferrer"
            // 埋点：答题推荐位的返佣点击，和教程页的点击分开看（from 区分来源）
            onClick={() => track("referral_click", { target: product.id, meta: { from: "decider_result" } })}
            className={[
              "flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition",
              product.has_paid_guide || product.has_free_guide
                ? "border border-slate-300 text-slate-700 hover:border-slate-400"
                : "bg-slate-900 text-white hover:bg-slate-700",
            ].join(" ")}
          >
            免费:去开户 ↗
          </a>
        ) : (
          // 没有直达链接的产品(应用商店搜索/邀请码限量):给指引而不是死链
          <p className="flex-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-center text-xs leading-relaxed text-slate-600">
            {product.signup_note ?? "开户入口见教程"}
          </p>
        )}
      </div>

      {product.referral_code && (
        <p className="mt-2 text-xs text-slate-500">
          邀请码:<code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{product.referral_code}</code>
          {" "}注册时填写可拿新人奖励
        </p>
      )}
    </div>
  );
}

export default function Decider({ hero }: { hero?: React.ReactNode }) {
  const [passport, setPassport] = useState<PassportType | null>(null);
  const [hasOverseasAddress, setHasOverseasAddress] = useState<boolean | null>(
    null
  );
  const [goals, setGoals] = useState<Goal[]>([]);
  const [kyc, setKyc] = useState<KycTolerance | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function toggleGoal(g: Goal) {
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  const ready =
    passport !== null &&
    hasOverseasAddress !== null &&
    goals.length > 0 &&
    kyc !== null;

  const results = useMemo<ScoredProduct[]>(() => {
    if (!ready) return [];
    const answers: Answers = {
      passport: passport!,
      hasOverseasAddress: hasOverseasAddress!,
      goals,
      kyc: kyc!,
    };
    return getRecommendations(answers);
  }, [ready, passport, hasOverseasAddress, goals, kyc]);

  return (
    <>
      {/* 宽幅两栏:左 价值主张/教程库(hero),右 答题卡。窄屏纵向堆叠 */}
      <div className="gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start xl:gap-14">
        {hero && <div className="mb-8 lg:mb-0">{hero}</div>}

        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:sticky lg:top-6">
        <Question step={1} title="你的证件类型?">
          {passportOptions.map((o) => (
            <Pill
              key={o.value}
              active={passport === o.value}
              onClick={() => setPassport(o.value)}
            >
              {o.label}
            </Pill>
          ))}
        </Question>

        <Question step={2} title="是否有海外地址证明?">
          <Pill
            active={hasOverseasAddress === false}
            onClick={() => setHasOverseasAddress(false)}
          >
            无
          </Pill>
          <Pill
            active={hasOverseasAddress === true}
            onClick={() => setHasOverseasAddress(true)}
          >
            有(流水 / 水电账单等)
          </Pill>
        </Question>

        <Question step={3} title="你想要什么?(可多选)">
          {goalOptions.map((o) => (
            <Pill
              key={o.value}
              active={goals.includes(o.value)}
              onClick={() => toggleGoal(o.value)}
            >
              {o.label}
            </Pill>
          ))}
        </Question>

        <Question step={4} title="能接受的 KYC 难度?">
          {kycOptions.map((o) => (
            <Pill
              key={o.value}
              active={kyc === o.value}
              onClick={() => setKyc(o.value)}
            >
              {o.label}
            </Pill>
          ))}
        </Question>

        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            setSubmitted(true);
            // 埋点：访客真实在问什么身份能开什么——这是选题和写哪篇教程的第一手依据，
            // 比 RSS 打分靠谱。只记选项枚举值，没有任何可识别信息。
            track("decider_submit", {
              meta: {
                passport,
                hasOverseasAddress,
                goals,
                kyc,
                // 推荐命中了谁：配合 referral_click 就能看出「推了但没人点」的产品
                results: results.map((r) => r.product.id),
              },
            });
            // 结果区在下方,提交后带用户过去(等一帧渲染完再滚)
            setTimeout(() => {
              document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 60);
          }}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {ready ? "查看我的推荐" : "请先回答上面 4 个问题"}
        </button>
        </div>
      </div>

      {submitted && (
        <div id="results" className="mt-12 scroll-mt-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            给你的推荐
            <span className="ml-2 text-sm font-normal text-slate-400">
              共 {results.length} 个 · 按匹配度排序,建议先易后难依次开通
            </span>
          </h2>
          {results.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
              按你目前的条件,数据库里暂时没有完全匹配的产品。试试放宽
              「海外地址证明」或「KYC 难度」再看看。
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {results.map((item) => (
                <ResultCard key={item.product.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
