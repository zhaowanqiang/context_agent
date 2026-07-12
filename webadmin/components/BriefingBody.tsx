import Markdown from "@/components/Markdown";
import type { BriefingItem } from "@/lib/briefingItems";
import { parseBriefingItems } from "@/lib/briefingItems";

/**
 * 简报正文的结构化渲染：解析成功时按话题分组出条目卡
 * （摘要 / 来源域名短链 / 选题标注徽章 + 分数），
 * 裸 URL 不再撑满三行；解析不出（老简报/模型跑偏）回退 Markdown 原样渲染。
 * 尾部 ⚠️/📊 注脚行单独收成小字。
 */

function hostOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^(www|old)\./, "");
  } catch {
    return link.slice(0, 40);
  }
}

function splitNotes(bodyMd: string): { content: string; notes: string[] } {
  const notes: string[] = [];
  const rest: string[] = [];
  for (const line of bodyMd.split("\n")) {
    if (/^>\s*[⚠📊]/u.test(line.trim())) notes.push(line.replace(/^>\s*/, "").trim());
    else rest.push(line);
  }
  return { content: rest.join("\n").trim(), notes };
}

function MarkBadge({ item }: { item: BriefingItem }) {
  if (!item.mark) return null;
  const worthy = item.mark === "可做选题";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        worthy ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-500"
      }`}
    >
      {item.mark}
      {item.score != null && <b>{item.score}/10</b>}
    </span>
  );
}

export default function BriefingBody({ bodyMd }: { bodyMd: string }) {
  const items = parseBriefingItems(bodyMd);
  const { content, notes } = splitNotes(bodyMd);

  // 按出现顺序分组（Map 保序）
  const groups = new Map<string, BriefingItem[]>();
  for (const it of items) {
    if (!groups.has(it.topic)) groups.set(it.topic, []);
    groups.get(it.topic)!.push(it);
  }

  return (
    <div>
      {items.length === 0 ? (
        <Markdown text={content} />
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([topic, list]) => (
            <section key={topic}>
              <h3 className="border-l-[3px] border-amber-600 pl-2.5 text-[15px] font-bold leading-snug text-neutral-900">
                {topic}
              </h3>
              <div className="mt-3 space-y-3">
                {list.map((it, i) => (
                  <article key={i} className="rounded-lg border border-neutral-200/80 bg-neutral-50/60 px-4 py-3.5">
                    <p className="text-[14px] leading-relaxed text-neutral-700">{it.summary}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <MarkBadge item={it} />
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] text-neutral-400 underline decoration-neutral-300 underline-offset-4 transition hover:text-amber-700 hover:decoration-amber-400"
                      >
                        {hostOf(it.link)} ↗
                      </a>
                    </div>
                    {it.reason && (
                      <p className="mt-2 border-t border-neutral-200/60 pt-2 text-[12.5px] leading-relaxed text-neutral-500">
                        {it.reason}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {notes.length > 0 && (
        <div className="mt-5 space-y-1 border-t border-neutral-100 pt-3">
          {notes.map((n, i) => (
            <p key={i} className="text-[11.5px] leading-relaxed text-neutral-400">
              {n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
