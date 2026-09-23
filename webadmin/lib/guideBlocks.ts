/**
 * 教程正文的返佣标记：正文里单独一行写
 *
 *     ::referral{id=racknerd}
 *
 * 渲染时换成一张返佣卡片。为什么用标记而不是让编辑器存一个"CTA 插在第几段"：
 * 段落会被反复改，序号一改就错位；标记跟着文字走，改正文不会把 CTA 甩到别处。
 *
 * 为什么不做成 markdown-it 插件：插件得输出 HTML 字符串，而卡片是要带
 * onClick 埋点的 React 客户端组件，塞不进 dangerouslySetInnerHTML。
 * 所以这里按标记把正文切成段，markdown 段照常渲染，标记段渲染成组件。
 *
 * 无 server-only：纯函数，编辑器的客户端校验也要用。
 */

export type GuideBlock =
  | { kind: "md"; markdown: string }
  | { kind: "referral"; id: string };

/** 整行只有标记才算——正文里提到 `::referral{...}` 这串字（比如写文档）不该被吃掉 */
const DIRECTIVE_RE = /^::referral\{\s*id\s*=\s*([A-Za-z0-9_-]+)\s*\}$/;

export function splitGuideBlocks(markdown: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let buf: string[] = [];

  const flush = () => {
    const md = buf.join("\n").trim();
    if (md) blocks.push({ kind: "md", markdown: md });
    buf = [];
  };

  // 代码围栏里的标记是示例文本，不能切——切了会把围栏劈成两半，下半截整页错乱
  let fence: string | null = null;
  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (fence === null) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
    }
    const m = fence === null ? DIRECTIVE_RE.exec(line.trim()) : null;
    if (m) {
      flush();
      blocks.push({ kind: "referral", id: m[1] });
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks;
}

/** 正文里引用了哪些返佣 id（编辑器用来校验拼写、发布闸门用来拦无效引用） */
export function referencedReferralIds(markdown: string): string[] {
  return splitGuideBlocks(markdown)
    .filter((b): b is { kind: "referral"; id: string } => b.kind === "referral")
    .map((b) => b.id);
}
