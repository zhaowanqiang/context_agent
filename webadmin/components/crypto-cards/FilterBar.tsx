"use client";

import { FILTERS, SORTS, type FilterId, type SortId } from "@/lib/cryptoCards";

/**
 * 筛选 chips + 排序。移动端横向滚动、隐藏滚动条。
 *
 * chip 上带数量是刻意的：43 张卡里只有 3 张填了事实字段，
 * 「支持中国大陆 (2)」这个数字看着难看，但它是真的——
 * 不标数量的话访客要点进去才发现筛出来几乎是空的，那更糟。
 *
 * 注意这里的选项比常见做法少：没有「免 KYC」「高返现」这类 chip，
 * 因为仓库里没有费率来源，也没有一张免 KYC 的卡——筛出来永远是空列表。
 */
export default function FilterBar({
  filter,
  sort,
  onFilter,
  onSort,
  counts,
  total,
}: {
  filter: FilterId;
  sort: SortId;
  onFilter: (f: FilterId) => void;
  onSort: (s: SortId) => void;
  counts: Record<FilterId, number>;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {/* 总数移到筛选条左侧，与 chip 同一基线 */}
        <span className="shrink-0 text-[13px] font-medium tabular-nums text-neutral-700">
          {total} 张
        </span>
        <span aria-hidden="true" className="h-4 w-px shrink-0 bg-neutral-200" />
        <div
          role="group"
          aria-label="筛选卡片"
          className="cc-noscrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:pb-0"
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const n = counts[f.id] ?? 0;
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
                <span className={`ml-1 tabular-nums ${active ? "text-white/70" : "text-neutral-600"}`}>
                  ({n})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
