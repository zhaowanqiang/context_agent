"use client";

import { useState } from "react";
import { createRun } from "@/app/actions/runs";
import type { ActionResult } from "@/app/actions/runs";
import type { TrackId } from "@/lib/types";

export default function NewRunForm({
  track,
  seedMaterial,
  feedItemId,
  clipId = null,
}: {
  track: TrackId;
  seedMaterial: string;
  feedItemId: string | null;
  /** 从剪藏收件箱进来的种子：创建成功后剪藏标记 used */
  clipId?: string | null;
}) {
  // 不用 useActionState（内部走 transition）：Next 16 的 React transition 竞态 bug（#88767）
  const [state, setState] = useState<ActionResult | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setIsPending(true);
        try {
          // 成功时 createRun 内部 redirect 跳到 run 页；只有校验失败才会返回
          const r = await createRun(undefined, formData);
          if (r?.error) {
            setState(r);
            setIsPending(false);
          }
        } catch {
          setIsPending(false); // redirect 之外的异常
        }
      }}
      className="space-y-4"
    >
      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {state.error}
        </div>
      )}
      {feedItemId && <input type="hidden" name="feed_item_id" value={feedItemId} />}
      {clipId && <input type="hidden" name="clip_id" value={clipId} />}
      <input type="hidden" name="track" value={track} />
      <textarea
        name="material"
        defaultValue={seedMaterial}
        required
        rows={18}
        placeholder={track === "wechat" ? "粘贴原文全文 + 你的补充观点（二次创作的底料）" : "粘贴原始素材（实测笔记，越具体越好）"}
        className="md-editor w-full rounded-md border border-neutral-300 bg-white p-4 focus:border-neutral-500 focus:outline-none"
      />
      {track === "wechat" && (
        <p className="text-xs text-neutral-400">
          公众号轨道是二次创作：原文全文是底料（从选题池进来会自动抓取），「补充观点」可选——填了你的判断，稿子的观点密度会高很多。
        </p>
      )}
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
