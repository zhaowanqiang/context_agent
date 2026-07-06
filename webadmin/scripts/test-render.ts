import { renderWechatHtml } from "../lib/wechat/render";

const md = [
  "## 先说结论",
  "",
  "我测下来 **速度快** 了很多，具体见 [官网](https://example.com)。",
  "",
  "| 项目 | 免费档 |",
  "|---|---|",
  "| 转写 | 每月 10 小时 |",
  "",
  "```",
  "pip install foo",
  "```",
  "",
  "行内 `code` 测试。[截图：转写结果页]",
].join("\n");

const html = renderWechatHtml(md);
console.log(html);
console.log("---checks---");
console.log("h2 styled:", html.includes("<h2 style="));
console.log("table styled:", html.includes("<table style="));
console.log("link as span+url:", html.includes("（链接：https://example.com）"));
console.log("pre wrap:", html.includes("white-space:pre-wrap"));
console.log("no class attr:", !html.includes("class="));
console.log("section wrapper:", html.startsWith("<section style="));
