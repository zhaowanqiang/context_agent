import "server-only";
import MarkdownIt from "markdown-it";

// 教程正文渲染:与 zynqorw 工作台成稿阅读视图同款(markdown-it + .md-body 样式)。
// html:false —— 内容来自本仓库 data/guides.ts,但保持关闭内联 HTML 的习惯。
// ⚠️ 本模块只能在服务端用:付费 markdown 绝不能进客户端 bundle。
const md = new MarkdownIt({ html: false, breaks: true, linkify: true });

export function renderMarkdown(markdown: string): string {
  return md.render(markdown);
}
