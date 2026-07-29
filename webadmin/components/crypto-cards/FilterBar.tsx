"use client";

import { FILTERS, SORTS, type FilterId, type SortId } from "@/lib/cryptoCards";

/**
 * 筛选 chips + 排序。移动端横向滚动、隐藏滚动条。
 *
 * 注意这里的选项比常见做法少：没有「免 KYC」「高返现」这类 chip，
 * 因为仓库里没有费率来源，也没有一张免 KYC 的卡——筛出来永远是空列表，
 * 那不是筛选器，那是死路。要加回来先在 crypto-cards.ts 补真实字段。
 */
export default function FilterBar({
  filter,
  sort,
  onFilter,
  onSort,
  count,
}: {
  filter: FilterId;
  sort: SortId;
  onFilter: (f: FilterId) => void;
  onSort: (s: SortId) => void;
  count: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        role="group"
        aria-label="筛选卡片"
        className="cc-noscrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:pb-0"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              onClick={() => onFilter(f.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[12px] text-neutral-600">{count} 张</span>
        <label className="sr-only" htmlFor="cc-sort">
          排序方式
        </label>
        <select
          id="cc-sort"
          value={sort}
          onChange={(e) => onSort(e.target.value as SortId)}
          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[13px] text-neutral-700"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
