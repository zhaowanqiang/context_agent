/**
 * data/tutorials.json 的 schema。类型单独成文件（不带 server-only）：
 * 客户端组件只 import 类型，数据本身由服务端筛过之后经 props 传下去。
 *
 * 字段含义：
 * - keyword：Telegram 群里的触发词，成员发这个词，机器人回对应教程
 * - telegramDeepLink：点开后机器人私聊发送该教程
 * - sections：一个教程可以有多个产品段落（如 Bitget Wallet 新旧两张卡）
 * - shared：带这个标记的段落是多个教程共用的推荐位（如 xesim-cta），由统一组件渲染一次
 *
 * 结构由 scripts/check-tutorials.mjs 在构建期校验（挂在 prebuild 上）。
 */

/** register = 注册 / 购买链接（邀请链接）；tutorial = X 上的完整教程 */
export type TutorialLinkKind = "register" | "tutorial";

export interface TutorialLink {
  label: string;
  url: string;
  kind: TutorialLinkKind;
}

/** 汇总类教程里的一行产品（如 U 卡汇总）。url / code 都可能没有 */
export interface TutorialItem {
  name: string;
  url: string | null;
  code: string | null;
  text: string;
}

export interface TutorialSection {
  title: string;
  notes: string[];
  codes: string[];
  links: TutorialLink[];
  items: TutorialItem[];
  shared?: string;
}

export interface Tutorial {
  slug: string;
  name: string;
  keyword: string;
  summary: string;
  category: string;
  telegramDeepLink: string;
  related: string[];
  sections: TutorialSection[];
}

export interface TutorialCategory {
  id: string;
  name: string;
  icon: string;
  tutorials: string[];
}

export interface TutorialsData {
  source: string;
  botUsername: string;
  groupLink: string;
  categories: TutorialCategory[];
  tutorials: Tutorial[];
}

/* ── 传给客户端的视图模型（已经过隐藏分类过滤）────────────────── */

export interface TutorialRef {
  slug: string;
  name: string;
}

export interface TutorialView extends Omit<Tutorial, "related" | "sections"> {
  /** 自有段落（不含共用推荐位） */
  sections: TutorialSection[];
  /** 本教程末尾挂的共用推荐位 id，内容在 sharedSections() 里 */
  sharedIds: string[];
  /** 相关推荐：已去掉隐藏分类里的教程，最多 3 条 */
  related: TutorialRef[];
  /** /cards 里对应的卡片（有才给），用于互链 */
  cards: { slug: string; name: string }[];
}

export interface CategoryView {
  id: string;
  name: string;
  icon: string;
  tutorials: TutorialView[];
  /** 本分类教程共用的推荐位 id（分类末尾统一渲染一次） */
  sharedIds: string[];
}

/** /cards 详情面板里展示的「来自教程导航的邀请码与注册链接」 */
export interface CardTutorialLink {
  tutorialSlug: string;
  tutorialName: string;
  offers: { title: string; code: string | null; url: string | null; label: string | null }[];
}
