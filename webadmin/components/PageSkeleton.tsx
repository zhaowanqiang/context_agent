/** 导航切换时的即时骨架屏：让每次点击立刻有视觉反馈，数据到了再替换 */
export default function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-40 rounded bg-neutral-200" />
      <div className="flex gap-2">
        <div className="h-6 w-16 rounded bg-neutral-200" />
        <div className="h-6 w-16 rounded bg-neutral-200" />
        <div className="h-6 w-16 rounded bg-neutral-200" />
      </div>
      <div className="divide-y divide-neutral-100 rounded border border-neutral-200 bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-4 w-10 rounded bg-neutral-100" />
            <div className="h-4 flex-1 rounded bg-neutral-100" />
            <div className="h-4 w-16 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
