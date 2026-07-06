import { renderMarkdown } from "@/lib/markdown";

/** 渲染 markdown 为排版好的正文（.md-body 样式见 globals.css） */
export default function Markdown({ text }: { text: string }) {
  return <div className="md-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}
