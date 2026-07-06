/**
 * 公众号排版主题：标签 → 内联样式。
 * 公众号编辑器会剥掉 <style> 块、class、id，只有内联 style 幸存 —— 所以全部内联。
 */
export const THEME: Record<string, string> = {
  section:
    "font-size:15px;line-height:1.75;letter-spacing:0.5px;color:#3f3f3f;word-break:break-word;",
  h1: "font-size:20px;font-weight:bold;color:#222;margin:28px 8px 16px;line-height:1.4;",
  h2: "font-size:17px;font-weight:bold;color:#222;margin:28px 8px 14px;padding-left:10px;border-left:4px solid #10a37f;line-height:1.5;",
  h3: "font-size:16px;font-weight:bold;color:#333;margin:22px 8px 12px;line-height:1.5;",
  h4: "font-size:15px;font-weight:bold;color:#333;margin:18px 8px 10px;",
  p: "margin:16px 8px;",
  blockquote:
    "margin:16px 8px;padding:10px 14px;background:#f7f7f7;border-left:3px solid #d0d0d0;color:#666;font-size:14px;",
  ul: "margin:16px 8px;padding-left:24px;",
  ol: "margin:16px 8px;padding-left:24px;",
  li: "margin:6px 0;",
  strong: "font-weight:bold;color:#222;",
  em: "font-style:italic;",
  hr: "border:none;border-top:1px solid #e5e5e5;margin:28px 8px;",
  table:
    "border-collapse:collapse;margin:16px 8px;width:calc(100% - 16px);font-size:14px;",
  thead: "background:#f5f5f5;",
  tr: "border-bottom:1px solid #e5e5e5;",
  th: "padding:8px 10px;border:1px solid #e0e0e0;text-align:left;font-weight:bold;color:#333;",
  td: "padding:8px 10px;border:1px solid #e0e0e0;color:#3f3f3f;",
  // pre-wrap + break-all：手机端代码横向滚动是重灾区，宁可折行
  pre: "margin:16px 8px;padding:12px;background:#f6f8fa;border-radius:4px;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-all;font-family:Menlo,Consolas,monospace;",
  code: "background:#f2f2f2;border-radius:3px;padding:2px 5px;font-size:13px;font-family:Menlo,Consolas,monospace;color:#c7254e;",
  img: "max-width:100%;display:block;margin:16px auto;",
  // 公众号正文会剥外链，链接渲染为带明文 URL 的 span（见 render.ts）
  a: "color:#576b95;",
};
