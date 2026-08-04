/**
 * 装配台「纸页」样式表——成品的视觉身份，不是后台 UI 的一部分。
 *
 * 为什么是一段 TS 字符串而不是 globals.css 里的规则：
 * 这套样式要同时喂给两个消费者——右侧实时预览，以及「导出单文件 HTML / PDF」
 * 生成的那份**脱离本站运行**的独立文档。后者必须把 CSS 原样内联进去，
 * 而 Tailwind 编译产物在运行时读不到（也不该去读 DOM 里的 <style> 反解）。
 * 存成常量，两边引同一个源，预览长什么样导出就是什么样。
 *
 * 所有选择器都挂在 .tp-paper 下，保证注入到后台页面时不污染站内任何元素。
 * 主色走 --tp-brand（取色器实时写入），字体不引外部 webfont（与全站一致）。
 */
export const PAPER_CSS = `
.tp-paper{
  background:#FCFBF8;color:#1A1A18;position:relative;overflow:hidden;
  font:15.5px/1.85 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;
  -webkit-font-smoothing:antialiased;
}
.tp-paper .tp-wm{position:absolute;inset:0;pointer-events:none;z-index:5;opacity:.075;
  display:flex;flex-wrap:wrap;align-content:flex-start;gap:0;overflow:hidden}
.tp-paper .tp-wm span{font:11px/1 ui-monospace,SFMono-Regular,Consolas,monospace;color:#000;
  transform:rotate(-28deg);padding:34px 26px;white-space:nowrap;flex:0 0 auto}
.tp-paper .tp-body{position:relative;z-index:1}

.tp-paper .tp-cover{min-height:640px;display:flex;flex-direction:column;justify-content:flex-end;
  padding-bottom:26px;border-bottom:3px solid var(--tp-brand);margin-bottom:44px;break-after:page}
.tp-paper .tp-cover .tp-tag{font:600 11px/1 ui-monospace,SFMono-Regular,Consolas,monospace;
  letter-spacing:.2em;text-transform:uppercase;color:var(--tp-brand);margin-bottom:auto;padding-top:8px}
.tp-paper .tp-cover h1{font-size:40px;line-height:1.22;letter-spacing:-.02em;margin:0 0 14px;font-weight:700}
.tp-paper .tp-cover .tp-sub{font-size:16px;color:#4A4A44;margin:0 0 26px;max-width:34em}
.tp-paper .tp-cover .tp-meta{font:12px/1.9 ui-monospace,SFMono-Regular,Consolas,monospace;color:#6B6B63}
.tp-paper .tp-cover .tp-meta b{color:#1A1A18;font-weight:600}

.tp-paper .tp-toc{margin:0 0 42px;padding:20px 22px;background:#F3F1EA;
  border-left:3px solid var(--tp-brand);border-radius:2px}
.tp-paper .tp-toc h4{margin:0 0 10px;font:600 11px/1 ui-monospace,SFMono-Regular,Consolas,monospace;
  letter-spacing:.16em;text-transform:uppercase;color:var(--tp-brand)}
.tp-paper .tp-toc ol{margin:0;padding-left:1.4em;font-size:14px;line-height:2}
.tp-paper .tp-toc a{color:#1A1A18;text-decoration:none}
.tp-paper .tp-toc a:hover{color:var(--tp-brand)}

.tp-paper h2{font-size:24px;line-height:1.4;margin:44px 0 6px;letter-spacing:-.01em;font-weight:700}
.tp-paper h2::after{content:"";display:block;width:44px;height:3px;background:var(--tp-brand);margin-top:12px}
.tp-paper h3{font-size:17px;margin:30px 0 8px;font-weight:600}
.tp-paper p{margin:0 0 15px}
.tp-paper ul,.tp-paper ol{margin:0 0 15px;padding-left:1.5em}
.tp-paper li{margin-bottom:6px}
.tp-paper strong{font-weight:600}
.tp-paper a{color:var(--tp-brand)}
.tp-paper code{font:13px/1 ui-monospace,SFMono-Regular,Consolas,monospace;background:#EFEDE5;
  padding:2px 6px;border-radius:3px;word-break:break-all}
.tp-paper blockquote{margin:0 0 15px;padding:12px 16px;background:#F3F1EA;
  border-left:3px solid #C9C5B4;color:#4A4A44;font-size:14.5px}
.tp-paper hr{border:0;border-top:1px solid #DDD9CB;margin:34px 0;break-after:page}

.tp-paper figure{margin:20px 0 24px;break-inside:avoid}
.tp-paper figure img{width:100%;display:block;border:1px solid #E3DFD2;border-radius:4px}
.tp-paper figcaption{font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;color:#6B6B63;
  margin-top:8px;padding-left:11px;border-left:2px solid var(--tp-brand)}
.tp-paper .tp-missing{padding:26px;text-align:center;background:#FAF0E8;border:1px dashed #D8A87A;
  border-radius:4px;color:#9A6634;font:12px/1 ui-monospace,SFMono-Regular,Consolas,monospace}

.tp-paper .tp-endnote{margin-top:52px;padding-top:18px;border-top:1px solid #DDD9CB;
  font-size:12.5px;line-height:1.85;color:#6B6B63;break-inside:avoid}
`.trim();

/** 导出/打印用的独立文档：纸页样式 + 一层最小的页面外壳，不依赖本站任何资源 */
export function standaloneDoc(title: string, brand: string, bodyHtml: string): string {
  const t = title.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title><style>
:root{--tp-brand:${/^#[0-9a-fA-F]{3,8}$/.test(brand) ? brand : "#0F6E68"}}
*{box-sizing:border-box}
body{margin:0;background:#E8E6DF;padding:24px 12px}
.tp-paper{max-width:820px;margin:0 auto;padding:56px 60px;border-radius:4px;
  box-shadow:0 2px 24px rgba(0,0,0,.1)}
@media(max-width:700px){body{padding:0}.tp-paper{padding:28px 20px;border-radius:0}}
@media print{
  body{background:#fff;padding:0}
  .tp-paper{box-shadow:none;max-width:none;padding:0;border-radius:0}
  .tp-paper .tp-wm{position:fixed}
  @page{size:A4;margin:16mm 14mm}
}
${PAPER_CSS}</style></head><body><div class="tp-paper">${bodyHtml}</div></body></html>`;
}
