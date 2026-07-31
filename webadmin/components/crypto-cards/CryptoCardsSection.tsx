"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cards, maxUpdatedAt } from "@/data/crypto-cards";
import { filterCounts, matchesFilter, sortCards, type FilterId, type SortId } from "@/lib/cryptoCards";
import CardDetail, { TABS, type Tab } from "./CardDetail";
import CardTile from "./CardTile";
import DecisionHelper from "./DecisionHelper";
import FacePatterns from "./FacePatterns";
import FilterBar from "./FilterBar";

const HASH_PREFIX = "#card-";

/* 哪张卡展开，唯一事实来源就是地址栏的 hash——不在 React 里另存一份。
   这样直链进入、浏览器后退、点关闭三条路径天然一致，不需要来回同步。
   hash 属于「外部系统」，所以用 useSyncExternalStore 订阅它，
   而不是在 effect 里 setState（那会引发级联渲染，eslint 也会拦）。 */
const HASH_EVENT = "cc:navigate"; // pushState/replaceState 不触发 popstate，得自己广播

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  window.addEventListener(HASH_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(HASH_EVENT, onChange);
  };
}

/** 订阅的是「hash + query」整体：哪张卡展开看 hash，停在哪个 tab 看 ?tab= */
function readHash(): string {
  return window.location.search + window.location.hash;
}

/** SSR 阶段没有 URL 片段：返回空串，首屏渲染成「没有展开的卡」 */
function readHashServer(): string {
  return "";
}

function slugFromUrl(url: string): string | null {
  const i = url.indexOf(HASH_PREFIX);
  return i === -1 ? null : slugOf(url.slice(i));
}

/** ?tab= 只认三个已知值，别的（含手写乱值）一律回落到默认页 */
function tabFromUrl(url: string): Tab {
  const m = /[?&]tab=([a-z]+)/.exec(url);
  const found = TABS.find((t) => t.id === m?.[1]);
  return found?.id ?? "decision";
}

function slugOf(hash: string): string | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const slug = hash.slice(HASH_PREFIX.length);
  return cards.some((c) => c.slug === slug) ? slug : null;
}

/** 改完地址栏立刻广播，让订阅者重新读取 */
function navigate(mutate: () => void) {
  mutate();
  window.dispatchEvent(new Event(HASH_EVENT));
}

export default function CryptoCardsSection() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortId>("default");
  const url = useSyncExternalStore(subscribeHash, readHash, readHashServer);
  const openSlug = slugFromUrl(url);
  const openTab = tabFromUrl(url);
  // 详情是我们 pushState 打开的，还是用户带着 hash 直接进来的——决定关闭时该 back 还是 replace
  const pushed = useRef(false);

  const open = useCallback((slug: string) => {
    // 打开时不带 tab：默认停在「开户决策」，URL 里就不写多余的 query
    navigate(() => window.history.pushState(null, "", `${window.location.pathname}${HASH_PREFIX}${slug}`));
    pushed.current = true;
  }, []);

  /* 切 tab 用 replaceState 而不是 pushState：
     浏览器后退键应该是「关闭面板」，不该变成「退回上一个 tab」，
     否则连点三个 tab 之后要按四次后退才回得到列表。 */
  const selectTab = useCallback((t: Tab) => {
    navigate(() => {
      const q = t === "decision" ? "" : `?tab=${t}`;
      window.history.replaceState(null, "", `${window.location.pathname}${q}${window.location.hash}`);
    });
  }, []);

  const close = useCallback(() => {
    // 关闭时把 ?tab= 一起抹掉，避免列表页 URL 上挂着无意义的 query
    // 我们压过一条历史 → 回退，让浏览器后退键和关闭按钮行为一致；
    // 直链进来的没有可退的上一步，改成抹掉 hash，否则会把人退出站外
    if (pushed.current) {
      pushed.current = false;
      window.history.back(); // 会触发 popstate，订阅者自然重算
    } else {
      navigate(() => window.history.replaceState(null, "", window.location.pathname));
    }
  }, []);

  const visible = useMemo(
    () => sortCards(cards.filter((c) => matchesFilter(c, filter)), sort),
    [filter, sort]
  );
  const openCard = openSlug ? cards.find((c) => c.slug === openSlug) ?? null : null;

  const counts = useMemo(() => filterCounts(cards), []);

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* 图案几何整页只声明一次，43 张卡按 id 复用 */}
      <FacePatterns />
      <header className="flex gap-3">
        <span aria-hidden="true" className="mt-1 w-[3px] shrink-0 self-stretch rounded-full bg-amber-600" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-[28px]">加密卡片</h1>
          <p className="mt-1 text-[13px] text-neutral-500">
            精选加密支付卡 · 数据更新于 {maxUpdatedAt()}
          </p>
        </div>
      </header>

      <div className="mt-6">
        <DecisionHelper onOpenCard={open} />
      </div>

      <div className="mt-6">
        <FilterBar
          filter={filter}
          sort={sort}
          onFilter={setFilter}
          onSort={setSort}
          counts={counts}
          total={visible.length}
        />
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-[13px] text-neutral-600">
          没有符合这个条件的卡。
        </p>
      ) : (
        /* auto-fill + minmax 代替固定断点：列数由可用宽度自己算。
           最小列宽取 280 而不是 300：站点 <main> 有 max-width:1024px，
           /cards 的实际可用宽度只有 944px，300px 起跳会掉到 2 列。
           280 → 375:1 列 / 768:2 列 / 1280:3 列。
           1600 想上 4-5 列必须先放宽 <main> 的站点级 max-width，那是全站改动，没动。 */
        <div
          className="mt-6 grid gap-6"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
        >
          {visible.map((card) => (
            <CardTile key={card.slug} card={card} onOpen={() => open(card.slug)} />
          ))}
        </div>
      )}

      <p className="mt-8 text-[11.5px] leading-relaxed text-neutral-600">
        本页为个人实测记录，<b className="font-medium text-neutral-800">不构成投资或理财建议</b>；
        邀请码与开户链接为返佣链接（我可能获得推荐奖励，不影响你的费用）；
        跨境政策与费率随时会变，标「待核实」的字段表示尚未实测核实，请以官方页面为准。
      </p>

      {openCard && <CardDetail card={openCard} tab={openTab} onTab={selectTab} onClose={close} />}
    </div>
  );
}
