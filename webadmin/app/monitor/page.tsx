import { Suspense } from "react";
import Link from "next/link";
import { addMonitorTopic } from "@/app/actions/monitor";
import { db } from "@/lib/supabase";
import type { Briefing, MonitorTopic } from "@/lib/types";
import { parseBriefingItems } from "@/lib/briefingItems";
import Markdown from "@/components/Markdown";
import MonitorTopicRowActions from "@/components/MonitorTopicRowActions";
import BriefingDeleteButton from "@/components/BriefingDeleteButton";
import BriefingRunButton from "@/components/BriefingRunButton";
import BriefingXPostPanel from "@/components/BriefingXPostPanel";
import { MonitorLeftRail, XPostDraftsRail } from "@/components/MonitorRails";

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const [briefingsRes, topicsRes] = await Promise.all([
    db().from("briefings").select("*").order("created_at", { ascending: false }).limit(30),
    db().from("monitor_topics").select("*").order("position").order("created_at"),
  ]);
  if (briefingsRes.error || topicsRes.error) {
    const msg = briefingsRes.error?.message ?? topicsRes.error?.message;
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">读取失败：{msg}（若表不存在，先在 Supabase SQL Editor 执行 schema.sql 里「监控简报模块」增量段）</div>;
  }
  const briefings = (briefingsRes.data ?? []) as Briefing[];
  const topics = (topicsRes.data ?? []) as MonitorTopic[];
  const [latest, ...history] = briefings;
  const latestItems = latest ? parseBriefingItems(latest.body_md) : [];

  return (
    // xl 起三栏：左 概况/用量/入口 | 中 简报阅读 | 右 选题转帖（吸顶）；窄屏侧栏落到正文下方/隐藏
    <div className="xl:grid xl:grid-cols-[240px_minmax(0,1fr)_330px] xl:items-start xl:gap-6">
      <aside className="hidden xl:sticky xl:top-6 xl:block xl:space-y-4">
        <Suspense fallback={null}>
          <MonitorLeftRail />
        </Suspense>
      </aside>

      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-semibold">📡 监控简报</h1>
            <p className="mt-1 text-xs text-neutral-400">
              每天定时检索下方话题的 48 小时新动态（Google News / Bing / Reddit / HN 四源 → 规则闸 → DeepSeek 按 X 选题价值打分），也可手动跑一期。
            </p>
          </div>
          <BriefingRunButton />
        </div>

        {/* 最新一期直接展开读 */}
        {latest ? (
          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-bold text-neutral-900">{latest.title}</h2>
              <span className="flex shrink-0 items-center gap-2">
                {latest.item_count != null && (
                  <span className="text-xs text-neutral-400">{latest.item_count} 条</span>
                )}
                <BriefingDeleteButton id={latest.id} />
              </span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-400">
              {new Date(latest.created_at).toLocaleString("zh-CN")}
            </p>
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <Markdown text={latest.body_md} />
            </div>
          </section>
        ) : (
          <section className="rounded-xl border-2 border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400">
            还没有简报。点右上角「立即生成简报」跑第一期。
          </section>
        )}

        {/* 历史简报 */}
        {history.length > 0 && (
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">历史简报</h2>
            <ul className="divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
              {history.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Link href={`/monitor/${b.id}`} className="min-w-0 flex-1 transition-colors hover:text-amber-700">
                    <span className="block truncate text-sm font-medium">{b.title}</span>
                    <span className="block text-xs text-neutral-400">
                      {new Date(b.created_at).toLocaleString("zh-CN")}
                      {b.item_count != null && ` · ${b.item_count} 条`}
                    </span>
                  </Link>
                  <BriefingDeleteButton id={b.id} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 话题管理（左栏「管理监控话题」锚点落这里） */}
        <section id="topics" className="scroll-mt-6 space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">监控话题</h2>
          <ul className="divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${t.enabled ? "bg-green-500" : "bg-neutral-300"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.name}</span>
                  {t.keywords && <span className="block truncate text-xs text-neutral-400">关键词：{t.keywords}</span>}
                  {t.note && <span className="block truncate text-xs text-neutral-400">备注：{t.note}</span>}
                </span>
                <MonitorTopicRowActions id={t.id} enabled={t.enabled} />
              </li>
            ))}
            {topics.length === 0 && <li className="px-4 py-3 text-sm text-neutral-500">还没有监控话题。</li>}
          </ul>

          <form action={addMonitorTopic} className="space-y-2 rounded border border-neutral-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-neutral-700">添加话题</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input name="name" required placeholder="话题名" className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm sm:w-44" />
              <input name="keywords" placeholder="搜索关键词（中英文，可选）" className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm" />
              <input name="note" placeholder="筛选备注（可选）" className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm" />
              <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700">
                添加
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              改动即刻生效：每期简报按当前启用的话题检索。关键词用 / 分隔多个检索变体（中英文各写一个覆盖面最好）。
            </p>
          </form>
        </section>
      </div>

      <aside className="mt-8 space-y-4 xl:sticky xl:top-6 xl:mt-0 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
        {latest && <BriefingXPostPanel briefingId={latest.id} items={latestItems} />}
        <Suspense fallback={null}>
          <XPostDraftsRail />
        </Suspense>
      </aside>
    </div>
  );
}
