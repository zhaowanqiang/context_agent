"use client";

import { useState } from "react";

/** 复制富文本（text/html + text/plain 双格式），供粘贴进公众号编辑器 */
export default function CopyRichTextButton({
  html,
  markdown,
  onCopied,
}: {
  html: string;
  markdown: string;
  onCopied?: () => void;
}) {
  const [tip, setTip] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([markdown], { type: "text/plain" }),
        }),
      ]);
      setTip("已复制 → 粘贴后等图片转存完，检查有没有空白图");
      onCopied?.();
      window.open("https://mp.weixin.qq.com/", "_blank");
    } catch (e) {
      setTip(`复制失败：${(e as Error).message}`);
    }
    setTimeout(() => setTip(null), 6000);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={copy}
        className="rounded bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-600"
      >
        复制正文并打开公众号后台
      </button>
      {tip && <span className="text-xs text-neutral-500">{tip}</span>}
    </span>
  );
}
