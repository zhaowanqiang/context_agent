"use client";

import { useEffect, useRef, useState } from "react";
import { TG_KEYWORDS, TG_QR_IMAGE } from "@/data/tg-keywords";
import { TG_BOT, TG_GROUP_URL } from "@/lib/site";

/**
 * 首页「交流群」区块：说明入群能拿到什么 + 关键词标签云（点击复制）+ 入群按钮。
 * 关键词和二维码都来自 data/tg-keywords.ts，改数据不用动这里。
 */
export default function TgGroupSection() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy(keyword: string) {
    try {
      await navigator.clipboard.writeText(keyword);
    } catch {
      return; // 无剪贴板权限（非安全上下文）：静默，不给假的成功反馈
    }
    setCopied(keyword);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section className="border-t border-neutral-200 pt-10" aria-labelledby="tg-group-title">
      <p className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.18em] text-amber-700">
        Telegram group
      </p>
      <div className="mt-2 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:items-start lg:gap-14">
        <div>
          <h2
            id="tg-group-title"
            className="font-display text-[26px] font-bold leading-snug tracking-tight text-neutral-900 sm:text-3xl"
          >
            发一个关键词，直接拿教程。
          </h2>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-neutral-600">
            加入交流群后，在群里发下面任意一个关键词，机器人 {TG_BOT} 会回复对应的教程链接——
            不用翻我的 X 主页找帖子。点标签可以复制关键词。
          </p>

          <ul className="mt-6 flex flex-wrap gap-2" aria-label="机器人关键词">
            {TG_KEYWORDS.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => copy(k)}
                  aria-label={`复制关键词 ${k}`}
                  className="rounded-full border border-neutral-300 bg-white px-3.5 py-1.5 font-mono text-[13px] text-neutral-700 transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                >
                  {copied === k ? "已复制 ✓" : k}
                </button>
              </li>
            ))}
          </ul>
          <p aria-live="polite" className="sr-only">
            {copied ? `已复制关键词 ${copied}` : ""}
          </p>

          <a
            href={TG_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-block rounded-lg bg-amber-700 px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-amber-800"
          >
            加入 TG 交流群 ↗
          </a>
        </div>

        {TG_QR_IMAGE ? (
          // 二维码走 <img>：public/ 下的静态文件，不需要 next/image 的优化链路
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={TG_QR_IMAGE}
            alt="Telegram 交流群二维码"
            width={240}
            height={240}
            className="mx-auto rounded-xl border border-neutral-200 bg-white p-3 lg:mx-0"
          />
        ) : (
          <div className="mx-auto flex aspect-square w-full max-w-[240px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/60 p-4 text-center lg:mx-0">
            <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-amber-800">PLACEHOLDER</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-600">
              群二维码待提供
              <br />
              data/tg-keywords.ts → TG_QR_IMAGE
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
