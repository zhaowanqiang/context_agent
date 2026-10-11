"use client";

import InviteCode from "@/components/crypto-cards/InviteCode";
import type { TutorialItem, TutorialSection } from "@/lib/tutorialTypes";
import { track } from "@/lib/track";

/* 外链的 rel 分两档（用户定的规则）：
   注册 / 购买链接和带邀请码的条目是返佣链接，向搜索引擎如实声明 sponsored；
   X 原文、Telegram 这类不是推广链接，只做安全隔离。 */
export const REL_SPONSORED = "sponsored nofollow noopener noreferrer";
export const REL_PLAIN = "noopener noreferrer";

const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-solid px-4 py-2 text-[14px] font-medium text-on-solid transition hover:bg-accent-solid-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mark";
export const BTN_SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 py-2 text-[14px] font-medium text-ink transition hover:border-accent-mark hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mark";

/** 汇总类教程的一行产品。「点名称直达注册，点邀请码可复制」 */
function ItemRow({ item, tutorialSlug }: { item: TutorialItem; tutorialSlug: string }) {
  // text 多数是「名称 邀请码 XXX」的重复；只有带了名称和邀请码之外的信息时才显示
  const redundant =
    item.text.trim() === item.name.trim() ||
    (item.code !== null && item.text.replace(/\s+/g, "") === `${item.name}邀请码${item.code}`.replace(/\s+/g, ""));

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel={item.code ? REL_SPONSORED : REL_PLAIN}
            onClick={
              item.code
                ? () => track("referral_click", { target: tutorialSlug, meta: { from: "tutorials_item", item: item.name } })
                : undefined
            }
            className="min-w-0 text-[14px] font-medium text-accent underline decoration-accent-line underline-offset-4 transition hover:text-accent-strong"
          >
            {item.name} <span aria-hidden>↗</span>
          </a>
        ) : (
          <span className="min-w-0 text-[14px] font-medium text-ink-strong">{item.name}</span>
        )}
        {item.code && (
          <InviteCode code={item.code} cardSlug={tutorialSlug} from="tutorials_code" comfortable className="max-w-[240px] basis-[190px]" />
        )}
      </div>
      {!redundant && <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{item.text}</p>}
    </li>
  );
}

/**
 * 教程的一个段落：标题 → 说明 → 邀请码 → 注册 / 完整教程按钮 → 产品列表。
 * 只渲染 JSON 里有的东西——没有注册链接就没有注册按钮，不补任何内容。
 * 共用推荐位（SharedCta）也复用这个组件，只是外面多一层强调底。
 */
export default function SectionBlock({
  section,
  tutorialSlug,
  headingLevel = "h3",
}: {
  section: TutorialSection;
  /** 埋点 target */
  tutorialSlug: string;
  headingLevel?: "h3" | "h4";
}) {
  const Heading = headingLevel;
  const registers = section.links.filter((l) => l.kind === "register");
  const tutorials = section.links.filter((l) => l.kind === "tutorial");

  return (
    <div>
      <Heading className="text-[15px] font-semibold leading-snug text-ink-strong">{section.title}</Heading>

      {section.notes.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {section.notes.map((n) => (
            <li key={n} className="text-[13.5px] leading-relaxed text-ink-muted">
              {n}
            </li>
          ))}
        </ul>
      )}

      {section.codes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {section.codes.map((c) => (
            <InviteCode key={c} code={c} cardSlug={tutorialSlug} from="tutorials_code" comfortable className="max-w-[240px] basis-[190px]" />
          ))}
        </div>
      )}

      {(registers.length > 0 || tutorials.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {registers.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel={REL_SPONSORED}
              onClick={() =>
                track("referral_click", { target: tutorialSlug, meta: { from: "tutorials_register", section: section.title } })
              }
              className={BTN_PRIMARY}
            >
              {l.label} <span aria-hidden className="ml-1">↗</span>
            </a>
          ))}
          {tutorials.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel={REL_PLAIN} className={BTN_SECONDARY}>
              {l.label} <span aria-hidden className="ml-1">↗</span>
            </a>
          ))}
        </div>
      )}

      {section.items.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {section.items.map((it) => (
            <ItemRow key={it.name} item={it} tutorialSlug={tutorialSlug} />
          ))}
        </ul>
      )}
    </div>
  );
}
