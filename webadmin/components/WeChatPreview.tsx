"use client";

/** 手机宽度沙箱预览公众号排版效果 */
export default function WeChatPreview({ html }: { html: string }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;background:#fff;">${html}</body></html>`;
  return (
    <iframe
      srcDoc={doc}
      sandbox=""
      title="公众号预览"
      className="h-[560px] w-[375px] shrink-0 rounded border border-neutral-300 bg-white"
    />
  );
}
