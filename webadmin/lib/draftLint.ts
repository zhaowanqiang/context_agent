import "server-only";
import type { TrackId } from "./types";

/**
 * 成稿确定性校验（正则，零 LLM 成本）：Gate/质检是模型判断会漏，
 * 这里补一层机器兜底，专抓「格式契约被违反」类硬伤。
 * 结果块置顶进 checklist，空数组 = 全部通过不加噪音。
 */

/** 素材【原文图片】段里的图片 URL 白名单（没有该段或标注无图 → 空数组） */
function materialImageUrls(material: string): string[] {
  const section = material.split("【原文图片】")[1]?.split("【")[0] ?? "";
  return [...section.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);
}

/** 数字符：去掉图片/链接/markdown 记号后的非空白字符数（近似正文字数） */
function countChars(draft: string): number {
  return draft
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接留文字
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*>|`\-]/g, "")
    .replace(/\s/g, "").length;
}

/** 大纲「（成稿要求：全文 600–900 字…）」里的字数范围；没有则轨道默认 */
function wordRange(outline: string, track: TrackId): [number, number] | null {
  const m = outline.match(/成稿要求：[^）]*?(\d{3,5})\s*[–—~-]\s*(\d{3,5})\s*字/);
  if (m) return [Number(m[1]), Number(m[2])];
  if (track === "wechat") return [1200, 2500]; // 公众号默认篇幅（prompt 同款）
  return null; // X 帖长度弹性大，不卡
}

// 公众号红线里的绝对化用语（广告法向）。「绝对」「第一」误报太多（绝对不/第一步）不进清单
const ABSOLUTE_WORDS = ["最强", "秒杀", "吊打", "全网最", "史上最"];

export function lintDraft(
  track: TrackId,
  draft: string,
  material: string,
  outline: string
): string[] {
  const issues: string[] = [];

  // 1. 残留生成标记：这些是流程内部契约，出现在成稿里就是漏网
  const pending = draft.match(/\[待核实\]/g);
  if (pending) issues.push(`残留 [待核实] 标记 ${pending.length} 处——发布前核实后删除标记`);
  if (draft.includes("（成稿要求：")) issues.push("「（成稿要求：…）」指令行漏进了正文——删除该行");

  // 2. 配图链接白名单：成稿里的图片 URL 必须来自素材【原文图片】，其余視为编造
  const allowed = new Set(materialImageUrls(material));
  const drafted = [...draft.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);
  for (const url of drafted) {
    if (!allowed.has(url)) issues.push(`配图链接不在素材图片清单中（疑似编造，发布必挂图）：${url}`);
  }
  // 素材有真图却全用占位 → 提醒（有真图就该直接嵌）
  if (allowed.size > 0 && drafted.length === 0 && /\[配图[:：]/.test(draft)) {
    issues.push("素材【原文图片】有可用图，但成稿只写了 [配图] 占位——应直接嵌素材图");
  }

  // 3. 字数范围（默认范围放宽 ±20% 才报，成稿要求指定的范围严格卡）
  const range = wordRange(outline, track);
  if (range) {
    const n = countChars(draft);
    const explicit = /成稿要求：[^）]*字/.test(outline);
    const [lo, hi] = explicit ? range : [range[0] * 0.8, range[1] * 1.2];
    if (n < lo) issues.push(`正文约 ${n} 字，低于要求下限 ${range[0]} 字——内容可能没展开`);
    if (n > hi) issues.push(`正文约 ${n} 字，超出要求上限 ${range[1]} 字——需要精简`);
  }

  // 4. 绝对化用语（仅公众号，红线明令避免）
  if (track === "wechat") {
    for (const w of ABSOLUTE_WORDS) {
      if (draft.includes(w)) issues.push(`绝对化用语「${w}」——红线要求避免，改为具体事实表述`);
    }
  }

  return issues;
}
