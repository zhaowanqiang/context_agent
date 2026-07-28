import type { Metadata } from "next";
import Link from "next/link";
import { formatVerified, listGuides, type Guide } from "@/lib/guides";

// ISR：与 /posts 同策略（公网门面 60s 再验证，本机因 layout 读 cookie 退回逐请求）
export const revalidate = 60;

export const metadata: Metadata = {
  title: "教程",
  description: "海外账户、加密支付卡、AI 工具的保姆级实操教程——每一步都是我自己走过一遍写下来的。",
};

/** 公开层：教程库列表。与 /posts 的区别是这里按「最后核对时间」标新鲜度，
 *  不按发布日排流水——教程是会反复回来修的常青内容。 */
export default async function GuidesPage() {
  let guides: Guide[] = [];
  try {
    guides = await listGuides();
  } catch {
    /* 表未建 / 库不可达：展示空态，不 500 */
  }

  return (
    <div className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
            教程<span className="text-amber-500">.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-neutral-500">
            海外账户、加密支付卡、AI 工具的保姆级实操——每一步都是我自己走过一遍写下来的，
            带截图，标注最后核对时间。政策变了我会回来改。
          </p>
        </div>
        {guides.length > 0 && (
          <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-neutral-400">
            {guides.length} guides
          </p>
        )}
      </div>

      {guides.length === 0 ? (
        <p className="mt-16 text-center text-[13.5px] text-neutral-400">教程正在整理中。</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <li key={g.id} className="flex">
              <Link
                href={`/guides/${g.slug}`}
                className="group flex flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-amber-300 hover:shadow-[0_1px_16px_rgba(180,83,9,0.07)]"
              >
                {g.cover_url && (
                  // 封面走 <img>：图片托在 Supabase 公开桶，域名随项目变，
                  // 用 next/image 还要在 next.config 里维护 remotePatterns 白名单
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.cover_url}
                    alt=""
                    className="h-36 w-full border-b border-neutral-200 object-cover"
                  />
                )}
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-[16px] font-semibold leading-snug text-neutral-900 transition group-hover:text-amber-700">
                    {g.title}
                  </h2>
                  {g.summary && (
                    <p className="mt-2 line-clamp-3 flex-1 text-[13px] leading-relaxed text-neutral-500">
                      {g.summary}
                    </p>
                  )}
                  <p className="mt-4 flex items-baseline justify-between text-[12.5px]">
                    <span className="font-medium text-amber-700">
                      看教程 <span className="inline-block transition group-hover:translate-x-0.5">→</span>
                    </span>
                    {g.verified_at && (
                      <span className="text-neutral-400">{formatVerified(g.verified_at)}</span>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
