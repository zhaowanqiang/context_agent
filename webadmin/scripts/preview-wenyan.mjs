// 临时：把 4 套 wenyan 主题渲染成对比页，供截图目检
import { JSDOM } from "jsdom";
import fs from "fs";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;

const wy = await import("@wenyan-md/core");
wy.registerAllBuiltInThemes();
wy.registerBuiltInHlThemes();
const core = await wy.createWenyanCore({ isConvertMathJax: false, isWechat: true, mermaid: false });

const md = [
  "## 先说结论",
  "",
  "我测下来 **速度快** 了很多，具体见 [官网](https://example.com)。",
  "",
  "| 项目 | 免费档 |",
  "|---|---|",
  "| 转写 | 每月 10 小时 |",
  "",
  "```js",
  "const a = 1;",
  "```",
  "",
  "> 引用一句话",
  "",
  "行内 `code` 测试。",
].join("\n");

let cells = "";
for (const themeId of ["default", "lapis", "orangeheart", "phycat"]) {
  const section = document.createElement("section");
  section.id = "wenyan";
  section.innerHTML = await core.renderMarkdown(md);
  const html = await core.applyStylesWithTheme(section, {
    themeId,
    hlThemeId: "github",
    isMacStyle: true,
    isAddFootnote: true,
  });
  cells += `<div style="width:375px;flex-shrink:0;border:1px solid #ccc;background:#fff;padding:16px"><div style="font:bold 14px sans-serif;margin-bottom:8px">${themeId}</div>${html}</div>`;
}
fs.writeFileSync(
  "wenyan-preview.html",
  `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:16px;background:#eee;display:flex;gap:16px;align-items:flex-start">${cells}</body></html>`
);
console.log("written wenyan-preview.html");
