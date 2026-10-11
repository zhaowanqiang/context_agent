"use client";

import Link from "next/link";
import DetailSheet from "@/components/DetailSheet";
import type { TutorialSection, TutorialView } from "@/lib/tutorialTypes";
import SectionBlock, { BTN_SECONDARY, REL_PLAIN } from "./SectionBlock";
import SharedCta from "./SharedCta";

/**
 * 教程详情面板：按 sections 分段展示，末尾依次是共用推荐位、Telegram 获取、
 * 加密卡片互链、相关推荐。所有内容来自 props（服务端从 tutorials.json 筛出来的），
 * 这里不写任何链接或邀请码。
 */
export default function TutorialDetail({
  tutorial,
  categoryName,
  shared,
  onOpen,
  onClose,
}: {
  tutorial: TutorialView;
  categoryName: string;
  /** 共用推荐位：id → 段落 */
  shared: Record<string, TutorialSection>;
  /** 点相关推荐：切到另一篇教程的详情 */
  onOpen: (slug: string) => void;
  onClose: () => void;
}) {
  const titleId = `tutorial-title-${tutorial.slug}`;

  return (
    <DetailSheet
      titleId={titleId}
      onClose={onClose}
      header={
        <>
          <p className="text-[12px] text-ink-subtle">
            {categoryName}
            <span aria-hidden> · </span>
            群内发送 <span className="font-mono font-medium text-ink-muted">{tutorial.keyword}</span>
          </p>
          <h2 id={titleId} className="mt-1 text-[19px] font-bold leading-snug text-ink-strong">
            {tutorial.name}
          </h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">{tutorial.summary}</p>
        </>
      }
    >
      <div className="space-y-6">
        {tutorial.sections.map((s) => (
          <SectionBlock key={s.title} section={s} tutorialSlug={tutorial.slug} />
        ))}

        {tutorial.sharedIds.map((id) =>
          shared[id] ? <SharedCta key={id} section={shared[id]} tutorialSlug={tutorial.slug} /> : null
        )}
      </div>

      {/* 在 Telegram 获取：点开后机器人私聊发送这篇教程 */}
      <div className="mt-6 border-t border-line pt-5">
        <a href={tutorial.telegramDeepLink} target="_blank" rel={REL_PLAIN} className={BTN_SECONDARY}>
          在 Telegram 获取 <span aria-hidden className="ml-1">↗</span>
        </a>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-subtle">
          点开后机器人会私聊把这篇教程发给你；在交流群里发送「{tutorial.keyword}」也可以。
        </p>
      </div>

      {tutorial.cards.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[12px] font-semibold text-ink-subtle">在加密卡片里看这张卡</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {tutorial.cards.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/cards#card-${c.slug}`}
                  className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-3.5 text-[13.5px] text-ink transition hover:border-accent-mark hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mark"
                >
                  {c.name} <span aria-hidden className="ml-1">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tutorial.related.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[12px] font-semibold text-ink-subtle">相关推荐</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {tutorial.related.map((r) => (
              <li key={r.slug}>
                <button
                  type="button"
                  onClick={() => onOpen(r.slug)}
                  className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-3.5 text-[13.5px] text-ink transition hover:border-accent-mark hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mark"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DetailSheet>
  );
}
