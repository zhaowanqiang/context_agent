"use client";

import { useState } from "react";
import { recommendCards, type HelperAnswers, type Usage } from "@/lib/cryptoCards";
import { track } from "@/lib/track";
import type { PassportType } from "@/lib/decider/types";

/**
 * 3 问决策器（可折叠，默认收起）。
 *
 * 打分不在这儿：recommendCards → lib/decider/match.ts 的 scoreProduct。
 * 全站只有一套权重，要调参去改那个文件，改完这里和 /decider 一起生效。
 */

const REGIONS: { value: PassportType; label: string }[] = [
  { value: "mainland", label: "中国大陆" },
  { value: "hk_macau_permit", label: "港澳" },
  { value: "overseas", label: "已有海外身份" },
];

const USAGES: { value: Usage; label: string }[] = [
  { value: "daily", label: "日常消费" },
  { value: "subscription", label: "订阅 AI / 软件" },
  { value: "withdraw", label: "大额提现出入金" },
];

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[13px] font-medium text-neutral-700">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

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
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-9 rounded-full border px-3 py-1.5 text-[13px] transition ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
      }`}
    >
      {children}
    </button>
  );
}

export default function DecisionHelper({ onOpenCard }: { onOpenCard: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState<PassportType | null>(null);
  const [fullKyc, setFullKyc] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [result, setResult] = useState<ReturnType<typeof recommendCards> | null>(null);

  const ready = region !== null && fullKyc !== null && usage !== null;

  function submit() {
    if (!ready) return;
    const answers: HelperAnswers = { region, fullKyc, usage };
    const r = recommendCards(answers);
    setResult(r);
    track("decider_submit", {
      meta: { ...answers, from: "cards_helper", results: r.top.map((t) => t.card.slug) },
    });
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="text-[15px] font-semibold text-neutral-900">不知道选哪张？回答 3 个问题</span>
          {/* 说明性文字用 neutral-600 而非站内常见的 400：
              #a8a29e 在白底上只有 2.5:1，过不了 WCAG AA（要 4.5:1）。
              neutral-500 也只有 4.37，同样不够——真要达标得走到 600。 */}
          <span className="mt-0.5 block text-[12.5px] text-neutral-600">
            按你的情况过滤，并说明每张卡为什么被排除
          </span>
        </span>
        <span className="shrink-0 text-neutral-400" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-neutral-100 px-5 py-5">
          <Row title="1. 你在哪儿？">
            {REGIONS.map((r) => (
              <Pill key={r.value} active={region === r.value} onClick={() => setRegion(r.value)}>
                {r.label}
              </Pill>
            ))}
          </Row>

          <Row title="2. 能接受完整 KYC 吗？（上传证件 + 地址证明）">
            <Pill active={fullKyc === true} onClick={() => setFullKyc(true)}>
              可以
            </Pill>
            <Pill active={fullKyc === false} onClick={() => setFullKyc(false)}>
              尽量避免
            </Pill>
          </Row>

          <Row title="3. 主要用来做什么？">
            {USAGES.map((u) => (
              <Pill key={u.value} active={usage === u.value} onClick={() => setUsage(u.value)}>
                {u.label}
              </Pill>
            ))}
          </Row>

          <button
            type="button"
            disabled={!ready}
            onClick={submit}
            className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-[13.5px] font-semibold text-white transition enabled:hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {ready ? "看推荐" : "请先答完 3 个问题"}
          </button>

          {result && (
            <div className="space-y-4 border-t border-neutral-100 pt-4">
              {result.top.length === 0 ? (
                <p className="text-[13px] text-neutral-500">
                  按你的条件，这 3 张卡都不合适。可以去
                  <a href="/decider" className="mx-1 text-amber-700 underline underline-offset-2">
                    出海开户决策
                  </a>
                  看看券商类产品。
                </p>
              ) : (
                <ul className="space-y-2">
                  {result.top.map(({ card, reason }, i) => (
                    <li key={card.slug}>
                      <button
                        type="button"
                        onClick={() => onOpenCard(card.slug)}
                        className="flex w-full items-baseline gap-2 rounded-lg border border-neutral-200 px-3 py-2.5 text-left transition hover:border-amber-300 hover:bg-amber-50/40"
                      >
                        <span className="text-[11px] font-bold text-amber-700">#{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold text-neutral-900">
                            {card.name}
                          </span>
                          <span className="block text-[12.5px] text-neutral-500">{reason}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {result.excluded.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    没推给你的
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {result.excluded.map(({ card, reason }) => (
                      <li key={card.slug} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                        <span className="text-neutral-500">{card.name}</span>
                        <span className="shrink-0 text-neutral-400">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
