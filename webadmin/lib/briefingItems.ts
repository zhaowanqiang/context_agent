/** 简报正文 markdown → 结构化条目。格式由 BRIEFING_PROMPT 约定
 *  （## 话题 / - **摘要**：… / - 来源：… / - 选题标注：…），解析不出就返回空数组，
 *  页面降级为纯阅读（老简报或模型偶尔跑偏格式都不报错）。 */

export interface BriefingItem {
  topic: string;
  summary: string;
  link: string;
  mark: "可做选题" | "仅参考" | "";
  reason: string;
}

export function parseBriefingItems(bodyMd: string): BriefingItem[] {
  const items: BriefingItem[] = [];
  let topic = "";
  let cur: Partial<BriefingItem> | null = null;
  const push = () => {
    if (cur?.summary && cur.link) {
      items.push({
        topic: cur.topic ?? "",
        summary: cur.summary,
        link: cur.link,
        mark: cur.mark ?? "",
        reason: cur.reason ?? "",
      });
    }
    cur = null;
  };
  for (const raw of bodyMd.split("\n")) {
    const line = raw.trim();
    const h = line.match(/^##\s+(.+)/);
    if (h) {
      push();
      topic = h[1].trim();
      continue;
    }
    const sm = line.match(/^-\s*\*\*摘要\*\*\s*[:：]\s*(.+)/);
    if (sm) {
      push();
      cur = { topic, summary: sm[1].trim() };
      continue;
    }
    if (!cur) continue;
    const lk = line.match(/^-\s*来源\s*[:：]\s*<?(\S+?)>?$/);
    if (lk) {
      cur.link = lk[1];
      continue;
    }
    // 「选题标注：」前缀模型偶尔会丢（直接输出「- **可做选题**（X 选题分 7/10）——」），两种都认
    const mk = line.match(/^-\s*(?:选题标注\s*[:：]\s*)?(\*?\*?(?:可做选题|仅参考).*)/);
    if (mk) {
      const rest = mk[1].replace(/\*\*/g, "").trim();
      cur.mark = rest.includes("可做选题") ? "可做选题" : rest.includes("仅参考") ? "仅参考" : "";
      cur.reason = (rest.split(/——|—-|--/)[1] ?? "").trim();
    }
  }
  push();
  return items;
}

/** 转 X 帖时喂给模型的选题文本 */
export function itemToMaterial(item: BriefingItem, briefingTitle: string): string {
  return [
    `【简报选题 · ${item.topic}】（来自 ${briefingTitle}）`,
    `摘要：${item.summary}`,
    item.reason ? `选题理由：${item.reason}` : null,
    `来源链接：${item.link}`,
  ]
    .filter(Boolean)
    .join("\n");
}
