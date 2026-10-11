"use client";

import type { TutorialSection } from "@/lib/tutorialTypes";
import SectionBlock from "./SectionBlock";

/**
 * 共用推荐位（JSON 里带 shared 标记的段落，目前是手机号教程末尾的 Xesim 推荐）。
 *
 * 同一段内容在 JSON 里挂在多篇教程下，是有意的引流设计；页面上由这一个组件统一渲染：
 * 分类末尾出现一次、每篇教程的详情末尾出现一次，不跟着教程卡片逐条重复。
 * 内容整段来自 JSON，这里只负责加一层强调底把它和教程正文区分开。
 */
export default function SharedCta({
  section,
  tutorialSlug,
  headingLevel,
}: {
  section: TutorialSection;
  /** 埋点 target：在哪篇教程（或哪个分类）下点的 */
  tutorialSlug: string;
  headingLevel?: "h3" | "h4";
}) {
  return (
    <aside className="rounded-xl border border-accent-line bg-accent-soft p-4">
      <SectionBlock section={section} tutorialSlug={tutorialSlug} headingLevel={headingLevel} />
    </aside>
  );
}
