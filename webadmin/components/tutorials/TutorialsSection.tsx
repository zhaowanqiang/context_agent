"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import InviteCode from "@/components/crypto-cards/InviteCode";
import type { CategoryView, TutorialSection, TutorialView } from "@/lib/tutorialTypes";
import SharedCta from "./SharedCta";
import TutorialDetail from "./TutorialDetail";

/* 「看哪个分类」「展开哪篇教程」的唯一事实来源是地址栏 hash——与 /cards 同一套做法：
     /tutorials#crypto-card   → 只看 U 卡分类
     /tutorials#bitget        → 展开 Bitget 教程
   这样在 X 和 Telegram 里分享的链接、浏览器后退、点关闭三条路径天然一致。
   hash 属于「外部系统」，用 useSyncExternalStore 订阅，不在 effect 里 setState。
   不认识的 hash（含暂不上线分类的 #network / #vps / #vpn——那些数据根本没传到浏览器）
   一律回落到总览。 */
const HASH_EVENT = "tutorials:navigate"; // pushState/replaceState 不触发 hashchange，得自己广播

function subscribeHash(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  window.addEventListener(HASH_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(HASH_EVENT, onChange);
  };
}

function readHash(): string {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return ""; // 手敲的畸形 %xx
  }
}

/** SSR 没有 hash：首屏渲染成「总览、没有展开的教程」，深链在水合后生效 */
const readHashServer = () => "";

function navigate(mutate: () => void) {
  mutate();
  window.dispatchEvent(new Event(HASH_EVENT));
}

const ALL = "all";

/** 卡片上的「主要邀请码」：自有段落里的第一个码；没有就不显示（不从产品列表里挑一个充数） */
function primaryCode(t: TutorialView): string | null {
  for (const s of t.sections) if (s.codes.length > 0) return s.codes[0];
  return null;
}

function matches(t: TutorialView, q: string): boolean {
  return t.name.toLowerCase().includes(q) || t.keyword.toLowerCase().includes(q);
}

function TutorialCard({ tutorial, onOpen }: { tutorial: TutorialView; onOpen: () => void }) {
  const code = primaryCode(tutorial);
  return (
    <li className="group relative flex flex-col rounded-xl border border-line bg-surface p-4 transition hover:border-accent-mark focus-within:border-accent-mark">
      <h3 className="text-[15.5px] font-semibold leading-snug text-ink-strong">
        {/* 整卡可点：按钮的 ::after 铺满卡片；邀请码复制区用 z-10 浮在上面，互不抢点击 */}
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          className="text-left outline-none transition after:absolute after:inset-0 after:rounded-xl group-hover:text-accent focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent-mark"
        >
          {tutorial.name}
        </button>
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{tutorial.summary}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3">
        <p className="text-[12px] text-ink-subtle">
          群内发送 <span className="font-mono font-medium text-ink-muted">{tutorial.keyword}</span>
        </p>
        {code && (
          <InviteCode
            code={code}
            cardSlug={tutorial.slug}
            from="tutorials_code"
            comfortable
            className="relative z-10 max-w-[190px] basis-[150px]"
          />
        )}
      </div>
    </li>
  );
}

export default function TutorialsSection({
  categories,
  shared,
}: {
  /** 已过滤掉暂不上线分类的数据（服务端筛好传下来） */
  categories: CategoryView[];
  shared: Record<string, TutorialSection>;
}) {
  const hash = useSyncExternalStore(subscribeHash, readHash, readHashServer);
  const [query, setQuery] = useState("");
  // 展开详情时列表停在哪个分类：hash 此刻被教程 slug 占着，分类只能另记一份
  const [tabBehindDetail, setTabBehindDetail] = useState(ALL);
  // 详情是我们 pushState 打开的，还是带着 hash 直接进来的——决定关闭时该 back 还是 replace
  const pushed = useRef(false);

  const bySlug = useMemo(() => {
    const m = new Map<string, TutorialView>();
    for (const c of categories) for (const t of c.tutorials) m.set(t.slug, t);
    return m;
  }, [categories]);
  const categoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);

  const openTutorial = bySlug.get(hash) ?? null;
  const tab = openTutorial ? tabBehindDetail : categoryIds.has(hash) ? hash : ALL;

  const selectTab = useCallback((id: string) => {
    // 换分类用 replaceState：浏览器后退不该变成「退回上一个分类」
    navigate(() =>
      window.history.replaceState(null, "", id === ALL ? window.location.pathname : `${window.location.pathname}#${id}`)
    );
  }, []);

  const open = useCallback(
    (slug: string) => {
      setTabBehindDetail(tab);
      if (openTutorial) {
        // 从详情里点相关推荐：替换当前这条历史，后退键仍然是「关闭面板」
        navigate(() => window.history.replaceState(null, "", `${window.location.pathname}#${slug}`));
      } else {
        navigate(() => window.history.pushState(null, "", `${window.location.pathname}#${slug}`));
        pushed.current = true;
      }
    },
    [tab, openTutorial]
  );

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back(); // 触发 popstate，回到打开前的分类
    } else {
      // 直链进来的没有可退的上一步：停在这篇教程所在的分类，而不是把人退出站外
      const cat = openTutorial?.category;
      navigate(() =>
        window.history.replaceState(null, "", cat ? `${window.location.pathname}#${cat}` : window.location.pathname)
      );
    }
  }, [openTutorial]);

  const q = query.trim().toLowerCase();
  const total = bySlug.size;

  // 搜索时跨全部分类找（不受当前分类限制），否则按分类 tab 展示
  const groups = useMemo(() => {
    const base = q !== "" || tab === ALL ? categories : categories.filter((c) => c.id === tab);
    return base
      .map((c) => ({ ...c, tutorials: q === "" ? c.tutorials : c.tutorials.filter((t) => matches(t, q)) }))
      .filter((c) => c.tutorials.length > 0);
  }, [categories, tab, q]);
  const shown = groups.reduce((n, c) => n + c.tutorials.length, 0);

  const chip = (active: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[14px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mark ${
      active
        ? "border-transparent bg-solid text-on-solid"
        : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink-strong"
    }`;

  return (
    <>
      <div className="mt-7">
        <label htmlFor="tutorial-search" className="sr-only">
          按名称或触发词搜索教程
        </label>
        <input
          id="tutorial-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索名称或触发词，如 wise、u卡"
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[16px] text-ink-strong outline-none transition placeholder:text-ink-subtle focus:border-accent-mark sm:max-w-sm sm:text-[14.5px]"
        />
      </div>

      {/* 5 个模块入口。手机上横向滚动，不折行占掉半屏 */}
      <nav aria-label="教程分类" className="cc-noscrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button type="button" aria-pressed={q === "" && tab === ALL} onClick={() => selectTab(ALL)} className={chip(q === "" && tab === ALL)}>
          全部
          <span className="ml-1.5 tabular-nums opacity-80">{total}</span>
        </button>
        {categories.map((c) => {
          const active = q === "" && tab === c.id;
          return (
            <button key={c.id} type="button" aria-pressed={active} onClick={() => selectTab(c.id)} className={chip(active)}>
              <span aria-hidden className="mr-1.5">
                {c.icon}
              </span>
              {c.name}
              <span className="ml-1.5 tabular-nums opacity-80">{c.tutorials.length}</span>
            </button>
          );
        })}
      </nav>

      {/* 搜索结果数对读屏播报；视觉上只在搜索时显示 */}
      <p aria-live="polite" className={q === "" ? "sr-only" : "mt-4 text-[13px] text-ink-subtle"}>
        {q === "" ? "" : `找到 ${shown} 篇教程（在全部分类中搜索）`}
      </p>

      {groups.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-line-strong p-8 text-center text-[13.5px] text-ink-muted">
          没有匹配的教程。换个名称或触发词试试，或者在交流群里直接问。
        </p>
      ) : (
        groups.map((c) => (
          <section key={c.id} aria-labelledby={`tutorial-cat-${c.id}`} className="mt-9">
            <h2 id={`tutorial-cat-${c.id}`} className="font-display text-[20px] font-bold tracking-tight text-ink-strong">
              <span aria-hidden className="mr-2">
                {c.icon}
              </span>
              {c.name}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.tutorials.map((t) => (
                <TutorialCard key={t.slug} tutorial={t} onOpen={() => open(t.slug)} />
              ))}
            </ul>
            {/* 共用推荐位：整个分类末尾只渲染一次，不跟着每张卡片重复 */}
            {q === "" &&
              c.sharedIds.map((id) =>
                shared[id] ? (
                  <div key={id} className="mt-4">
                    <SharedCta section={shared[id]} tutorialSlug={c.id} />
                  </div>
                ) : null
              )}
          </section>
        ))
      )}

      {openTutorial && (
        <TutorialDetail
          key={openTutorial.slug}
          tutorial={openTutorial}
          categoryName={categories.find((c) => c.id === openTutorial.category)?.name ?? ""}
          shared={shared}
          onOpen={open}
          onClose={close}
        />
      )}
    </>
  );
}
