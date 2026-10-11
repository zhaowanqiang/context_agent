import "server-only";
import raw from "@/data/tutorials.json";
import { cards } from "@/data/crypto-cards";
import type {
  CardTutorialLink,
  CategoryView,
  Tutorial,
  TutorialSection,
  TutorialsData,
  TutorialView,
} from "@/lib/tutorialTypes";

/**
 * 教程导航的数据层：data/tutorials.json 是唯一数据来源，这里只做筛选和派生，不补任何内容。
 *
 * server-only 是刻意的：隐藏分类的数据留在 JSON 里，但不能被打进浏览器 bundle——
 * 所以客户端组件拿到的永远是这里筛过之后、经 props 传下去的那部分。
 */

/**
 * 暂不上线的分类。列在这里的分类：/tutorials 不渲染入口和教程、搜索搜不到、
 * 不进 sitemap、对应 hash 回落到总览、别的教程的相关推荐里也会被过滤掉。
 * **想上线时只改这一处**（删掉对应 id 即可），JSON 不用动。
 */
export const HIDDEN_CATEGORIES: readonly string[] = ["network"];

// JSON 的 kind 字段被 TS 推断成 string，这里收窄到 schema；结构正确性由 check-tutorials.mjs 保证
const data = raw as TutorialsData;

const hidden = new Set(HIDDEN_CATEGORIES);
const bySlug = new Map(data.tutorials.map((t) => [t.slug, t]));
const isVisible = (t: Tutorial | undefined): t is Tutorial => t !== undefined && !hidden.has(t.category);

/** 相关推荐最多显示几条 */
const MAX_RELATED = 3;

/** 教程 slug → /cards 里指向它的卡片（data/crypto-cards.ts 的 tutorial 字段） */
function cardsFor(slug: string) {
  return cards.filter((c) => c.tutorial?.slug === slug).map((c) => ({ slug: c.slug, name: c.name }));
}

function toView(t: Tutorial): TutorialView {
  return {
    slug: t.slug,
    name: t.name,
    keyword: t.keyword,
    summary: t.summary,
    category: t.category,
    telegramDeepLink: t.telegramDeepLink,
    sections: t.sections.filter((s) => !s.shared),
    sharedIds: [...new Set(t.sections.flatMap((s) => (s.shared ? [s.shared] : [])))],
    related: t.related
      .map((slug) => bySlug.get(slug))
      .filter(isVisible)
      .slice(0, MAX_RELATED)
      .map((r) => ({ slug: r.slug, name: r.name })),
    cards: cardsFor(t.slug),
  };
}

/** 可见分类及其教程，顺序 = JSON 里 categories[].tutorials 的顺序 */
export function visibleCategories(): CategoryView[] {
  return data.categories
    .filter((c) => !hidden.has(c.id))
    .map((c) => {
      const tutorials = c.tutorials.map((slug) => bySlug.get(slug)).filter(isVisible).map(toView);
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        tutorials,
        sharedIds: [...new Set(tutorials.flatMap((t) => t.sharedIds))],
      };
    });
}

/** 共用推荐位：id → 段落内容（取第一次出现的那段；构建期校验保证同 id 的各段完全一致） */
export function sharedSections(): Record<string, TutorialSection> {
  const out: Record<string, TutorialSection> = {};
  for (const t of data.tutorials) {
    if (!isVisible(t)) continue;
    for (const s of t.sections) if (s.shared && !out[s.shared]) out[s.shared] = s;
  }
  return out;
}

/** 可见教程的群内触发词（首页交流群区块的标签云） */
export function visibleKeywords(): string[] {
  return data.tutorials.filter(isVisible).map((t) => t.keyword);
}

/** 某个可见分类下的教程数；分类被隐藏或不存在时为 0 */
export function tutorialCount(categoryId: string): number {
  return visibleCategories().find((c) => c.id === categoryId)?.tutorials.length ?? 0;
}

/**
 * /cards 用：卡片 slug → 它在教程导航里的说明、邀请码、注册链接与完整教程。
 * 卡片数据里只写「指向哪篇教程（的哪一行）」，码和链接一律从 JSON 现取——
 * 不在 crypto-cards.ts 里再抄一份，否则改一次要翻两个文件。
 */
export function cardTutorialLinks(): Record<string, CardTutorialLink> {
  const out: Record<string, CardTutorialLink> = {};
  for (const c of cards) {
    if (!c.tutorial) continue;
    const t = bySlug.get(c.tutorial.slug);
    if (t === undefined) {
      throw new Error(`[tutorials] 卡片 ${c.slug} 指向不存在的教程 ${c.tutorial.slug}`);
    }
    if (!isVisible(t)) continue; // 教程所在分类暂不上线：卡片上不出这块
    const wanted = c.tutorial.section;
    const own = t.sections.filter((s) => !s.shared && (wanted === undefined || s.title === wanted));
    if (wanted !== undefined && own.length === 0) {
      throw new Error(`[tutorials] 卡片 ${c.slug} 指向教程 ${t.slug} 里不存在的段落「${wanted}」`);
    }
    let offers: CardTutorialLink["offers"];
    if (c.tutorial.item) {
      const item = own.flatMap((s) => s.items).find((i) => i.name === c.tutorial?.item);
      if (!item) {
        throw new Error(`[tutorials] 卡片 ${c.slug} 指向教程 ${t.slug} 里不存在的条目「${c.tutorial.item}」`);
      }
      // 条目的 text 多数只是「名称 邀请码 XXX」的重复，带了别的信息才当说明带出
      const plain = (v: string) => v.replace(/\s+/g, "");
      const redundant =
        plain(item.text) === plain(item.name) ||
        (item.code !== null && plain(item.text) === plain(`${item.name}邀请码${item.code}`));
      offers = [
        {
          title: item.name,
          notes: redundant ? [] : [item.text],
          codes: item.code ? [item.code] : [],
          registerUrl: item.url,
          registerLabel: null,
          guides: [],
        },
      ];
    } else {
      offers = own.map((s) => {
        const reg = s.links.find((l) => l.kind === "register");
        return {
          title: s.title,
          notes: s.notes,
          codes: s.codes,
          registerUrl: reg?.url ?? null,
          registerLabel: reg?.label ?? null,
          guides: s.links.filter((l) => l.kind === "tutorial").map((l) => ({ label: l.label, url: l.url })),
        };
      });
    }
    out[c.slug] = {
      tutorialSlug: t.slug,
      tutorialName: t.name,
      summary: c.tutorial.item ? null : t.summary,
      keyword: t.keyword,
      telegramDeepLink: t.telegramDeepLink,
      offers,
    };
  }
  return out;
}
