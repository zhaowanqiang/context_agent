import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import type { Briefing } from "@/lib/types";
import { parseBriefingItems } from "@/lib/briefingItems";
import Markdown from "@/components/Markdown";
import BriefingDeleteButton from "@/components/BriefingDeleteButton";
import BriefingXPostPanel from "@/components/BriefingXPostPanel";
import { MonitorLeftRail, XPostDraftsRail } from "@/components/MonitorRails";

export const dynamic = "force-dynamic";

export default async function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await db().from("briefings").select("*").eq("id", id).maybeSingle();
  if (error) {
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">读取失败：{error.message}</div>;
  }
  if (!data) notFound();
  const briefing = data as Briefing;
  const items = parseBriefingItems(briefing.body_md);

  return (
    <div className="xl:grid xl:grid-cols-[240px_minmax(0,1fr)_330px] xl:items-start xl:gap-6">
      <aside className="hidden xl:sticky xl:top-6 xl:block xl:space-y-4">
        <Suspense fallback={null}>
          <MonitorLeftRail />
        </Suspense>
      </aside>

      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link href="/monitor" className="text-xs text-neutral-400 hover:text-neutral-700">
          ← 返回监控简报
        </Link>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="font-bold text-neutral-900">{briefing.title}</h1>
            <span className="flex shrink-0 items-center gap-2">
              {briefing.item_count != null && (
                <span className="text-xs text-neutral-400">{briefing.item_count} 条</span>
              )}
              <BriefingDeleteButton id={briefing.id} redirectTo="/monitor" />
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-400">
            {new Date(briefing.created_at).toLocaleString("zh-CN")}
          </p>
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <Markdown text={briefing.body_md} />
          </div>
        </div>
      </div>

      <aside className="mt-8 space-y-4 xl:sticky xl:top-6 xl:mt-0 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
        <BriefingXPostPanel briefingId={briefing.id} items={items} />
        <Suspense fallback={null}>
          <XPostDraftsRail />
        </Suspense>
      </aside>
    </div>
  );
}
