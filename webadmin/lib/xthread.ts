/**
 * X 教程线程 → 教程 markdown 的确定性转换。
 *
 * 为什么不上 LLM：这批线程本身就是分步骤写的（（1）（2）（3） / 1. 2. 3.），
 * 拆成 markdown 小标题是纯机械变换。过一道模型只会引入改写风险——
 * 开户教程里一个数字错了就是真损失，而这里没有任何需要"理解"的地方。
 * 想润色是发布前人工在编辑框里做的事。
 *
 * 无 server-only：纯函数，导入页的客户端预览也要用。
 */

/** 配图占位：原文 【此处为插图】 转成它，上传图片后替换。
 *  发布闸门会拦住残留的占位（见 app/actions/guides.ts）。 */
export const IMAGE_SLOT_PREFIX = "IMG_";

/** 步骤行：（1） (1) 1. 1、 1， 1/ 第一步 —— 这些写法在现有 6 篇里都出现过。
 *  「1，」是《注册Apple ID教程》的写法，全角逗号也得算分隔符。 */
const STEP_RE = /^\s*(?:第?\s*([0-9]{1,2}|[一二三四五六七八九十]+)\s*[步)）.、，,/]|[（(]\s*([0-9]{1,2})\s*[)）])\s*/;

/** 「具体步骤如下：」「开卡的具体流程：」——通篇没编号时，靠这行判断从哪开始算步骤 */
const STEP_LEAD_RE = /(?:流程|步骤|方法|教程|做法)[^\n]{0,6}[:：]\s*$/;

/** 配图占位：【此处为插图】【配图】[图] 及其变体 */
const IMAGE_RE = /^\s*[【[]\s*(?:此处为)?(?:插图|配图|图\d*|截图)\s*[】\]]\s*$/;

/** 标题句与正文的切点：第一个句读符号。截到这里当小标题，剩下的原样进正文——
 *  切分而不是摘要，所以一个字都不会丢。 */
const BREAK_RE = /[。！？，、；：]/;

const HEADING_MAX = 30;

export interface ParsedThread {
  /** 步骤前的开场白（产品是什么、为什么值得开） */
  intro: string[];
  steps: { n: number; heading: string; body: string }[];
  /** 配图占位数量：编辑页据此提示还有几个坑没填 */
  imageSlots: number;
  /** 结尾的杂项行（相关链接、邀请码等），原样保留 */
  outro: string[];
}

function cnNumber(s: string): number | null {
  const map: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  };
  return map[s] ?? null;
}

/** 把一行步骤文本切成「小标题 + 正文」。切不出来就整行当小标题，正文为空。 */
function splitHeading(text: string): { heading: string; body: string } {
  const m = BREAK_RE.exec(text);
  if (!m || m.index === 0 || m.index > HEADING_MAX) {
    // 没有句读，或第一个句读来得太晚：硬截当标题，剩下的进正文。
    // 不把整行重复进正文——那在页面上看着就是个 bug，人还得手动删一遍
    if (text.length <= HEADING_MAX) return { heading: text, body: "" };
    return { heading: `${text.slice(0, HEADING_MAX)}…`, body: text.slice(HEADING_MAX) };
  }
  return { heading: text.slice(0, m.index), body: text.slice(m.index + 1).trim() };
}

export function parseThread(raw: string): ParsedThread {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const intro: string[] = [];
  const steps: ParsedThread["steps"] = [];
  const outro: string[] = [];
  let imageSlots = 0;
  let seenStep = false;

  // 通篇没有一个编号（Savo / Bybit / plasma one 都是这样写的）时降级：
  // 从「开卡的具体流程：」这类引导行之后，每段各算一步自动编号。
  // 只在完全没编号时启用——Wise 有编号，但它的「具体步骤如下：」后面
  // 先跟了一段邀请链接，自动编号会把链接当成第 1 步。
  const hasExplicitSteps = lines.some((l) => STEP_RE.test(l.trim()) && l.trim().length > 3);
  const autoNumber = !hasExplicitSteps && lines.some((l) => STEP_LEAD_RE.test(l.trim()));
  let autoStarted = false;

  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;

    if (IMAGE_RE.test(text)) {
      imageSlots += 1;
      const slot = `![配图 ${imageSlots}](${IMAGE_SLOT_PREFIX}${imageSlots})`;
      // 占位跟着当前所在段落走，位置不能丢——图配错步骤比没图更糟
      if (steps.length > 0) {
        const last = steps[steps.length - 1];
        last.body = last.body ? `${last.body}\n\n${slot}` : slot;
      } else {
        intro.push(slot);
      }
      continue;
    }

    if (autoNumber) {
      if (!autoStarted) {
        intro.push(text);
        if (STEP_LEAD_RE.test(text)) autoStarted = true; // 引导行本身留在开场白末尾
        continue;
      }
      if (/^https?:\/\//.test(text)) {
        outro.push(text);
        continue;
      }
      steps.push({ n: steps.length + 1, ...splitHeading(text) });
      seenStep = true;
      continue;
    }

    const m = STEP_RE.exec(text);
    if (m) {
      const rawN = m[1] ?? m[2] ?? "";
      const n = /^\d+$/.test(rawN) ? Number(rawN) : (cnNumber(rawN) ?? steps.length + 1);
      const rest = text.slice(m[0].length).trim();
      if (rest) {
        steps.push({ n, ...splitHeading(rest) });
        seenStep = true;
        continue;
      }
    }

    if (!seenStep) {
      intro.push(text);
    } else if (steps.length > 0) {
      // 步骤开始后的非编号行：既可能是上一步的续写，也可能是结尾的相关链接。
      // 判据：裸链接行 / 「xxx：」结尾的引导行归 outro，其余续在上一步后面
      const isTail = /^https?:\/\//.test(text) || /[:：]\s*$/.test(text);
      if (isTail || outro.length > 0) {
        outro.push(text);
      } else {
        const last = steps[steps.length - 1];
        last.body = last.body ? `${last.body}\n\n${text}` : text;
      }
    }
  }

  return { intro, steps, imageSlots, outro };
}

export interface ToMarkdownOptions {
  /** 原推文/线程链接：写在正文末尾标注出处 */
  sourceUrl?: string | null;
}

export function toMarkdown(parsed: ParsedThread, opts: ToMarkdownOptions = {}): string {
  const out: string[] = [];
  if (parsed.intro.length > 0) out.push(parsed.intro.join("\n\n"));

  for (const s of parsed.steps) {
    out.push(`## ${s.n}. ${s.heading}`);
    if (s.body) out.push(s.body);
  }

  if (parsed.outro.length > 0) {
    out.push("---");
    out.push(parsed.outro.join("\n\n"));
  }

  if (opts.sourceUrl) {
    out.push("---");
    out.push(`本文首发于 X：${opts.sourceUrl}`);
  }

  return out.join("\n\n").trim() + "\n";
}

/** 一步到位：原文 → markdown。导入页用。 */
export function threadToMarkdown(raw: string, opts: ToMarkdownOptions = {}): string {
  return toMarkdown(parseThread(raw), opts);
}

/** 正文里还剩几个没填的配图位（发布闸门用） */
export function countUnfilledSlots(md: string): number {
  return md.match(new RegExp(`\\]\\(${IMAGE_SLOT_PREFIX}\\d+\\)`, "g"))?.length ?? 0;
}
