import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { runInFewshot } from "@/lib/fewshotStore";
import { postOfRun } from "@/lib/posts";
import { db } from "@/lib/supabase";
import type { Run } from "@/lib/types";
import { isTrackId, TRACK_LABEL } from "@/lib/types";
import RunStatusBadge from "@/components/RunStatusBadge";
import RunWorkbench from "@/components/RunWorkbench";
import SitePublishPanel from "@/components/SitePublishPanel";

export const dynamic = "force-dynamic";

export default async function RunPage({
  params,
}: {
  params: Promise<{ track: string; id: string }>;
}) {
  const { track, id } = await params;
  if (!isTrackId(track)) notFound();
  const { data, error } = await db().from("runs").select("*").eq("id", id).single();
  if (error || !data) notFound();
  const run = data as Run;
  // run 属于另一个轨道时纠正 URL（两个模块互不掺杂）
  if (run.track !== track) redirect(`/agent/${run.track}/runs/${id}`);
  // 终稿是否已喂入范例库（工作台按钮据此显示状态）
  const fewshotFile = await runInFewshot(run.track, run.id);
  // 已发布的 run：查是否已回流个人站（posts 表未建时静默降级，不挡工作台）
  const sitePost = run.status === "published" ? await postOfRun(run.id).catch(() => null) : null;

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/agent/${track}/runs`} className="text-xs text-neutral-400 hover:text-neutral-600">
          ← 返回 Runs
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-neutral-900">
            {run.title ?? "（未出大纲）"}
          </h1>
          <RunStatusBadge status={run.status} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
          <span>{TRACK_LABEL[run.track]}</span>
          <span>·</span>
          <span>{new Date(run.created_at).toLocaleString("zh-CN")}</span>
          {run.token_usage && (
            <>
              <span>·</span>
              <span>
                tokens {run.token_usage.input_tokens.toLocaleString()} 入 /{" "}
                {run.token_usage.output_tokens.toLocaleString()} 出
              </span>
            </>
          )}
        </div>
      </div>
      {/* key 含 status：状态流转时强制重挂载，编辑框从最新数据重新初始化 */}
      <RunWorkbench key={`${run.id}-${run.status}`} run={run} fewshotFile={fewshotFile} />
      {/* 平台发布后：终稿一键回流个人站公开层 */}
      {run.status === "published" && (
        <SitePublishPanel runId={run.id} post={sitePost ? { id: sitePost.id, slug: sitePost.slug } : null} />
      )}
    </div>
  );
}
