import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import NavLinks from "@/components/NavLinks";
import { LeftRail, RailSkeleton, RightRail } from "@/components/TrackRails";
import { isTrackId, TRACK_LABEL, TRACKS } from "@/lib/types";

/** 轨道壳：/wechat/** 与 /x/** 各自一套完全独立的导航与页面 */
export default async function TrackLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ track: string }>;
}) {
  const { track } = await params;
  if (!isTrackId(track)) notFound();

  const NAV = [
    { href: `/agent/${track}`, label: "仪表盘" },
    { href: `/agent/${track}/topics`, label: "选题池" },
    { href: `/agent/${track}/runs`, label: "Runs" },
    { href: `/agent/${track}/sources`, label: "内容源" },
    { href: `/agent/${track}/fewshot`, label: "范例库" },
  ];

  return (
    <div className="space-y-5">
      {/* 手机两行（切换器+新建 / 导航），sm 起收回一行 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 pb-3">
        {/* 平台切换：两个模块完全分离，这里是唯一的跨越点 */}
        <div className="flex shrink-0 rounded-md border border-neutral-300 text-sm">
          {TRACKS.map((t) => (
            <Link
              key={t}
              href={`/agent/${t}`}
              className={`whitespace-nowrap px-3 py-1 first:rounded-l-md last:rounded-r-md ${
                t === track
                  ? t === "wechat"
                    ? "bg-green-700 text-white"
                    : "bg-neutral-900 text-white"
                  : "bg-white text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              {TRACK_LABEL[t]}
            </Link>
          ))}
        </div>
        {/* 二级导航复用 NavLinks：当前页琥珀下划线，与顶栏同一套活跃态语言 */}
        <nav className="order-3 flex w-full items-center gap-4 text-sm sm:order-none sm:w-auto">
          <NavLinks items={NAV.map((n, i) => ({ ...n, exact: i === 0 }))} />
        </nav>
        <Link
          href={`/agent/${track}/runs/new`}
          className="ml-auto shrink-0 whitespace-nowrap rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-700"
        >
          + 新建 Run
        </Link>
      </div>

      {/* xl 起三栏：左=行动（快捷操作/节奏/用量），中=页面，右=情报（警报/范例库/发布/产线）。
          侧栏经 Suspense 流式注入不阻塞主内容；窄屏自动隐藏，主内容独占 */}
      <div className="xl:grid xl:grid-cols-[230px_minmax(0,1fr)_270px] xl:items-start xl:gap-6">
        <aside className="hidden xl:sticky xl:top-6 xl:block">
          <Suspense fallback={<RailSkeleton />}>
            <LeftRail track={track} />
          </Suspense>
        </aside>
        <div className="min-w-0">{children}</div>
        <aside className="hidden xl:sticky xl:top-6 xl:block">
          <Suspense fallback={<RailSkeleton />}>
            <RightRail track={track} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}
