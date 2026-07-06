"use client";

import { useActionState } from "react";
import { createRun } from "@/app/actions/runs";

export default function NewRunForm({
  seedMaterial,
  feedItemId,
  seedTrack,
}: {
  seedMaterial: string;
  feedItemId: string | null;
  seedTrack?: "x" | "wechat";
}) {
  const [state, formAction, isPending] = useActionState(createRun, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {state.error}
        </div>
      )}
      {feedItemId && <input type="hidden" name="feed_item_id" value={feedItemId} />}
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="track"
            value="x"
            defaultChecked={seedTrack === "x" || (!feedItemId && !seedTrack)}
            required
          />{" "}
          X 干货帖
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="track"
            value="wechat"
            defaultChecked={seedTrack === "wechat" || (!!feedItemId && !seedTrack)}
          />{" "}
          公众号长文
        </label>
      </div>
      <textarea
        name="material"
        defaultValue={seedMaterial}
        required
        rows={18}
        placeholder="粘贴原始素材（实测笔记，越具体越好）"
        className="md-editor w-full rounded-md border border-neutral-300 bg-white p-4 focus:border-neutral-500 focus:outline-none"
      />
      <p className="text-xs text-neutral-400">
        公众号轨道是二次创作：原文全文是底料（从选题池进来会自动抓取），「补充观点」可选——填了你的判断，稿子的观点密度会高很多。
      </p>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {isPending ? "创建中…" : "创建（下一步生成大纲）"}
      </button>
    </form>
  );
}
