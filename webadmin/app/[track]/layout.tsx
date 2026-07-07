import Link from "next/link";
import { notFound } from "next/navigation";
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
    { href: `/${track}`, label: "仪表盘" },
    { href: `/${track}/topics`, label: "选题池" },
    { href: `/${track}/runs`, label: "Runs" },
    { href: `/${track}/sources`, label: "内容源" },
    { href: `/${track}/fewshot`, label: "范例库" },
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
              href={`/${t}`}
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
        <nav className="order-3 flex w-full items-center gap-4 sm:order-none sm:w-auto">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap text-sm text-neutral-600 hover:text-neutral-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href={`/${track}/runs/new`}
          className="ml-auto shrink-0 whitespace-nowrap rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
        >
          + 新建 Run
        </Link>
      </div>
      {children}
    </div>
  );
}
