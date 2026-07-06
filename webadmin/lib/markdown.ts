/** 后台内部展示用的 markdown 渲染（checklist、成稿预览）。html:false，内容来自自家 LLM/DB。 */
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, breaks: true, linkify: true });

export function renderMarkdown(markdown: string): string {
  return md.render(markdown);
}
