import type { Metadata } from "next";
import Link from "next/link";
import { listAllGuides, type Guide } from "@/lib/guides";
import { countUnfilledSlots } from "@/lib/xthread";
import ImportThreadForm from "@/components/ImportThreadForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "教程导入" };

/* 私有层：把 X 上发过的教程线程转成站内教程。
   拆条是确定性的（见 lib/xthread.ts），不过模型；
   图片转存进 Supabase 公开桶，不引 X 的 CDN。 */
export default async function ImportPage() {
  let guides: Guide[] = [];
  let dbError: string | null = null;
  try {
    guides = await listAllGuides();
  } catch (e) {
    dbError = (e as Error).message;
  }
  const drafts = guides.filter((g) => g.status === "draft");
  const published = guides.filter((g) => g.status === "published");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">教程导入</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-400">
          粘贴 X 上发过的教程线程 → 自动拆成分步 markdown → 补图、改字 → 上站到 /guides。
          原文里的 <code className="rounded bg-neutral-100 px-1">【此处为插图】</code> 会变成配图位，
          发布前必须填掉或删掉。
        </p>
      </div>

      {dbError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          读取教程失败：{dbError}
          <br />
          <span className="text-[12px]">
            guides 表还没建？把 supabase/schema.sql 末尾那段增量在 SQL Editor 里跑一遍。
          </span>
        </p>
      )}

      <ImportThreadForm />

      <section>
        <h2 className="text-[13px] font-semibold text-neutral-700">
          草稿 <span className="font-normal text-neutral-400">{drafts.length}</span>
        </h2>
        {drafts.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-neutral-400">没有草稿。</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {drafts.map((g) => {
              const unfilled = countUnfilledSlots(g.content_md);
              return (
                <li key={g.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <Link href={`/import/${g.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-neutral-800">{g.title}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-neutral-400">/guides/{g.slug}</p>
                  </Link>
                  {unfilled > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-medium text-amber-800">
                      {unfilled} 个配图位待填
                    </span>
                  )}
                  <Link
                    href={`/import/${g.id}`}
                    className="shrink-0 text-[12.5px] font-medium text-amber-700 hover:underline"
                  >
                    编辑 →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[13px] font-semibold text-neutral-700">
          已上站 <span className="font-normal text-neutral-400">{published.length}</span>
        </h2>
        {published.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-neutral-400">还没有教程上站。</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {published.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <Link href={`/import/${g.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-neutral-800">{g.title}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-neutral-400">
                    /guides/{g.slug}
                    {g.verified_at && ` · ${g.verified_at} 核对`}
                  </p>
                </Link>
                <a
                  href={`/guides/${g.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-[12.5px] text-neutral-500 hover:text-amber-700"
                >
                  看线上 ↗
                </a>
                <Link
                  href={`/import/${g.id}`}
                  className="shrink-0 text-[12.5px] font-medium text-amber-700 hover:underline"
                >
                  编辑 →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
