/**
 * 验证 @wenyan-md/core 多主题渲染（Node + jsdom，模拟浏览器路径，
 * 与 lib/wechat/wenyan.ts 的调用方式一致）。
 * 用法：node scripts/test-wenyan.mjs [themeId]
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;

const { createWenyanCore, registerAllBuiltInThemes, registerBuiltInHlThemes } = await import(
  "@wenyan-md/core"
);

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
  "行内 `code` 测试。[截图：转写结果页]",
].join("\n");

registerAllBuiltInThemes();
registerBuiltInHlThemes();
const core = await createWenyanCore({ isConvertMathJax: false, isWechat: true, mermaid: false });

const themes = process.argv[2]
  ? [process.argv[2]]
  : ["default", "lapis", "orangeheart", "rainbow", "pie", "maize", "purple", "phycat"];

let failed = false;
for (const themeId of themes) {
  try {
    const section = document.createElement("section");
    section.id = "wenyan";
    section.innerHTML = await core.renderMarkdown(md);
    const html = await core.applyStylesWithTheme(section, {
      themeId,
      hlThemeId: "github",
      isMacStyle: true,
      isAddFootnote: true,
    });
    const ok =
      html.includes('id="wenyan"') && // 根元素
      /<h2[^>]+style="/.test(html) && // 标题带内联样式
      html.includes("引用链接") && // 外链转文末脚注
      !html.includes("<script"); // 无脚本注入
    console.log(`${ok ? "✓" : "✗"} ${themeId}  (${html.length} chars)`);
    if (!ok) failed = true;
  } catch (e) {
    console.log(`✗ ${themeId}  渲染抛错: ${e.message}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
