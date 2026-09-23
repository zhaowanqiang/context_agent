"use client";

import { useSyncExternalStore } from "react";
import { X_ARTICLE_TAGS, type XArticle, type XArticleTag } from "@/data/x-articles";

/* 筛选状态的唯一事实来源是地址栏 hash（/on-x#phone），不在 React 里另存一份——
   与 /cards 的卡片深链同一套做法：hash 是外部系统，用 useSyncExternalStore 订阅。
   服务端快照为空串 = 「全部」，首屏 HTML 与无 hash 访问一致，不会水合错位。 */
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const getHash = () => window.location.hash.slice(1);
const getServerHash = () => "";

const TAG_IDS = new Set<string>(X_ARTICLE_TAGS.map((t) => t.id));
const TAG_LABEL = Object.fromEntries(X_ARTICLE_TAGS.map((t) => [t.id, t.label])) as Record<XArticleTag, string>;

function setTag(tag: XArticleTag | null) {
  if (tag) {
    window.location.hash = tag; // 触发 hashchange；页面上没有同名 id，不会跳滚动
  } else {
    // 清 hash 用 replaceState（赋空串会留一个孤零零的 #），它不触发 hashchange，得自己广播
    history.replaceState(null, "", window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}

export default function XArticleList({ articles }: { articles: XArticle[] }) {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  // 不认识的 hash（手敲错、旧标签）按「全部」处理，不给空列表
  const active = TAG_IDS.has(hash) ? (hash as XArticleTag) : null;

  const present = X_ARTICLE_TAGS.filter((t) => articles.some((a) => a.tags.includes(t.id)));
  const shown = active ? articles.filter((a) => a.tags.includes(active)) : articles;

  return (
    <>
      <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="按标签筛选">
        <Chip label="全部" count={articles.length} on={active === null} onClick={() => setTag(null)} />
        {present.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            count={articles.filter((a) => a.tags.includes(t.id)).length}
            on={active === t.id}
            onClick={() => setTag(t.id)}
          />
        ))}
      </div>

      <ol className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
        {shown.map((a) => (
          <li key={a.id} className="py-5">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-500">
              <time dateTime={a.date} className="font-mono tabular-nums">
                {a.date}
              </time>
              {a.tags.map((t) => (
                <span key={t} className="rounded-full border border-neutral-200 bg-white px-2 py-px text-[11.5px]">
                  {TAG_LABEL[t]}
                </span>
              ))}
            </p>
            <h2 className="mt-2 text-[16.5px] font-semibold leading-snug">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-900 underline decoration-transparent underline-offset-4 transition hover:text-amber-800 hover:decoration-amber-400"
              >
                {a.title} <span aria-hidden className="text-amber-700">↗</span>
                <span className="sr-only">（在 X 上打开）</span>
              </a>
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-600">{a.summary}</p>
            {a.tgKeyword && (
              <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[12px] text-amber-900">
                群里发
                <code className="rounded bg-white px-1.5 font-mono text-[12px] text-amber-800">{a.tgKeyword}</code>
                获取
              </p>
            )}
          </li>
        ))}
      </ol>

      {shown.length === 0 && (
        <p className="mt-10 text-center text-[13.5px] text-neutral-500">这个标签下还没有文章。</p>
      )}
    </>
  );
}

function Chip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1 text-[12.5px] transition ${
        on
          ? "border-amber-300 bg-amber-50 font-medium text-amber-800"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
      }`}
    >
      {label} <span className="font-mono text-[11px] opacity-70">{count}</span>
    </button>
  );
}
