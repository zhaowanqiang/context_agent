/**
 * markdown → 公众号可粘贴的内联样式 HTML。
 * 客户端与服务端都可用（预览要跟随编辑实时变化，所以不加 server-only）。
 */
import MarkdownIt from "markdown-it";
import { THEME } from "./theme";

const md = new MarkdownIt({ html: false, breaks: true, linkify: false });

// 通用：给所有走 renderToken 的开标签注入内联样式
const defaultRenderToken = md.renderer.renderToken.bind(md.renderer);
md.renderer.renderToken = (tokens, idx, options) => {
  const token = tokens[idx];
  if (token.nesting === 1 && THEME[token.tag]) {
    token.attrSet("style", THEME[token.tag]);
  }
  return defaultRenderToken(tokens, idx, options);
};

// 行内代码
md.renderer.rules.code_inline = (tokens, idx) =>
  `<code style="${THEME.code}">${md.utils.escapeHtml(tokens[idx].content)}</code>`;

// 代码块（fence 与缩进代码统一处理）
const renderCodeBlock = (content: string) =>
  `<pre style="${THEME.pre}"><code>${md.utils.escapeHtml(content)}</code></pre>`;
md.renderer.rules.fence = (tokens, idx) => renderCodeBlock(tokens[idx].content);
md.renderer.rules.code_block = (tokens, idx) => renderCodeBlock(tokens[idx].content);

// 链接：公众号正文外链会被剥离，渲染成「文字（链接：url）」明文
const hrefStack: string[] = [];
md.renderer.rules.link_open = (tokens, idx) => {
  hrefStack.push(tokens[idx].attrGet("href") ?? "");
  return `<span style="${THEME.a}">`;
};
md.renderer.rules.link_close = () => {
  const href = hrefStack.pop();
  return href ? `（链接：${href}）</span>` : "</span>";
};

// 图片：加自适应样式（实际流程用 [截图：xxx] 占位、编辑器内手动传图，这里只兜底）
const defaultImage = md.renderer.rules.image!;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet("style", THEME.img);
  return defaultImage(tokens, idx, options, env, self);
};

/** 主入口：markdown 字符串 → 公众号内联 HTML */
export function renderWechatHtml(markdown: string): string {
  hrefStack.length = 0;
  const body = md.render(markdown);
  return `<section style="${THEME.section}">${body}</section>`;
}
