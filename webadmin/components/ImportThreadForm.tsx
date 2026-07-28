"use client";

import { useState } from "react";
import { importThread } from "@/app/actions/guides";
import { parseThread, toMarkdown } from "@/lib/xthread";

const input =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-[13px] outline-none focus:border-amber-400";

/** 粘贴 X 线程 → 实时预览拆条结果 → 存成草稿。
 *  预览在客户端跑同一个纯函数（lib/xthread 无 server-only），
 *  所见即入库内容，不会存进去才发现拆错了。 */
export default function ImportThreadForm() {
  const [raw, setRaw] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const parsed = raw.trim() ? parseThread(raw) : null;
  const preview = parsed ? toMarkdown(parsed, { sourceUrl: sourceUrl || null }) : "";

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      // 成功时 action 内部 redirect，不会走到这里
      const r = await importThread(formData);
      if (r?.error) setError(r.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[12px] font-medium text-neutral-600">标题</span>
          <input name="title" required placeholder="KAST 开卡实操" className={`mt-1 ${input}`} />
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-neutral-600">
            slug <span className="font-normal text-neutral-400">· URL 段，用英文</span>
          </span>
          <input name="slug" required placeholder="kast-card" className={`mt-1 ${input}`} />
        </label>
      </div>

      <label className="block">
        <span className="text-[12px] font-medium text-neutral-600">
          原推文链接 <span className="font-normal text-neutral-400">· 可空，填了会在文末标出处</span>
        </span>
        <input
          name="source_url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://x.com/zynqorw/status/…"
          className={`mt-1 ${input}`}
        />
      </label>

      <label className="block">
        <span className="text-[12px] font-medium text-neutral-600">线程原文</span>
        <textarea
          name="raw"
          required
          rows={10}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="把整条线程的文字粘进来。（1）（2）1. 1、 等编号会自动拆成步骤；没有编号的，「具体流程：」之后每段各算一步。"
          className={`mt-1 ${input} font-mono leading-relaxed`}
        />
      </label>

      {parsed && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-[12px] text-neutral-500">
            拆出 <b className="text-neutral-800">{parsed.steps.length}</b> 步 ·
            开场 {parsed.intro.length} 段 ·
            配图位 <b className="text-neutral-800">{parsed.imageSlots}</b> 个
            {parsed.outro.length > 0 && ` · 结尾 ${parsed.outro.length} 行`}
          </p>
          {parsed.steps.length === 0 && (
            <p className="mt-1 text-[12px] text-amber-700">
              一步都没拆出来——原文可能没有编号，也没有「具体流程：」这类引导行。
              存进去也行，之后在编辑器里手动加小标题。
            </p>
          )}
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-neutral-600">
            {preview}
          </pre>
        </div>
      )}

      {error && <p className="text-[12.5px] text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-amber-700 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-amber-800 disabled:opacity-60"
      >
        {pending ? "导入中…" : "导入成草稿"}
      </button>
    </form>
  );
}
