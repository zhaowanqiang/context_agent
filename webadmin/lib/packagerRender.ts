/**
 * 装配台的排版内核：正文（轻量 markdown）+ 图片托盘 → 纸页 HTML。
 *
 * 纯函数、无 server-only、无 DOM 依赖：预览、导出单文件 HTML、打印 PDF
 * 三条路径都调这里，保证「预览长什么样，卖出去的就是什么样」。
 *
 * 与站内 markdown（lib/markdown.ts，走 markdown-it）刻意分开：
 * 那套服务的是网页阅读流，这套服务的是**分页纸质成品**——认 [[n]] 图片标记、
 * --- 分页符，输出封面/目录/水印/页尾声明。两者语法子集重叠但目标不同，
 * 合并只会让任何一边多背对方的包袱。
 */

export interface TrayImage {
  /** 原始文件名（拖入的图）或来源标识（从教程载入的图） */
  name: string;
  /** data:URI（本地拖入 / 已内联）或远程 URL（从教程载入，尚未内联） */
  src: string;
  /** 图注，可空 */
  cap: string;
  /** true = src 还是远程链接：能预览、能打印，但导出的单文件 HTML 不自带图 */
  remote?: boolean;
}

export interface PaperMeta {
  title: string;
  sub: string;
  author: string;
  ver: string;
  /** 购买者水印，留空则不加 */
  buyer: string;
  brand: string;
  note: string;
  cover: boolean;
  toc: boolean;
}

export const EMPTY_META: PaperMeta = {
  title: "教程标题",
  sub: "一句话说清这份教程解决什么问题",
  author: "@zynqorw",
  ver: "v1.0",
  buyer: "",
  brand: "#0F6E68",
  note: "本教程为付费内容，仅供购买者本人使用。文中涉及的平台政策与费率会变动，操作前请以官方页面为准，风险自负。",
  cover: true,
  toc: true,
};

export function esc(s: string | undefined | null): string {
  return (s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!
  );
}

/** 行内语法：先整体转义，再放行受控的几种标记——顺序不能反 */
export function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // 链接只认 http/https，javascript: 之类协议进不来
    .replace(
      /\[([^\]]+)\]\((https?:[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    )
    .replace(
      /(^|[^"'>=\]])(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener">$2</a>'
    );
}

function figure(imgs: TrayImage[], n: number): string {
  const im = imgs[n - 1];
  if (!im) return `<div class="tp-missing">缺图 [[${n}]] — 托盘里还没有第 ${n} 张</div>`;
  // src 一并转义：工程 JSON 是可以被手改/外部传来的，别让它往标签里插属性
  return (
    `<figure><img src="${esc(im.src)}" alt="${esc(im.cap) || "图 " + n}">` +
    (im.cap ? `<figcaption>${inline(im.cap)}</figcaption>` : "") +
    "</figure>"
  );
}

/** 正文 → {html, heads}；heads 供目录用（只收 h1/h2） */
export function toBody(text: string, imgs: TrayImage[]): { html: string; heads: string[] } {
  const heads: string[] = [];
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  let html = "";

  for (const raw of blocks) {
    // 图片标记切出来单独成块——它不该被裹进段落里
    for (const p of raw.split(/(\[\[\d+\]\])/)) {
      const marker = p.match(/^\[\[(\d+)\]\]$/);
      if (marker) {
        html += figure(imgs, Number(marker[1]));
        continue;
      }
      const b = p.trim();
      if (!b) continue;
      if (/^---+$/.test(b)) {
        html += "<hr>";
        continue;
      }
      const lines = b.split("\n");

      if (/^#{1,3}\s/.test(lines[0]) && lines.length === 1) {
        const lv = lines[0].match(/^#+/)![0].length;
        const txt = lines[0].replace(/^#+\s*/, "");
        if (lv <= 2) {
          html += `<h2 id="tph${heads.length}">${inline(txt)}</h2>`;
          heads.push(txt);
        } else {
          html += `<h3>${inline(txt)}</h3>`;
        }
        continue;
      }
      if (lines.every((l) => /^\s*[-*]\s/.test(l))) {
        html +=
          "<ul>" +
          lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s/, ""))}</li>`).join("") +
          "</ul>";
        continue;
      }
      if (lines.every((l) => /^\s*\d+[.、)]\s/.test(l))) {
        html +=
          "<ol>" +
          lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.、)]\s*/, ""))}</li>`).join("") +
          "</ol>";
        continue;
      }
      if (lines.every((l) => /^\s*>/.test(l))) {
        html += `<blockquote>${lines
          .map((l) => inline(l.replace(/^\s*>\s?/, "")))
          .join("<br>")}</blockquote>`;
        continue;
      }
      // 混排块：逐行判，标题夹在段落中间也能认出来
      html += lines
        .map((l) => {
          if (/^#{1,3}\s/.test(l)) {
            const lv = l.match(/^#+/)![0].length;
            const txt = l.replace(/^#+\s*/, "");
            if (lv <= 2) {
              const id = `tph${heads.length}`;
              heads.push(txt);
              return `<h2 id="${id}">${inline(txt)}</h2>`;
            }
            return `<h3>${inline(txt)}</h3>`;
          }
          return `<p>${inline(l)}</p>`;
        })
        .join("");
    }
  }
  return { html, heads };
}

/**
 * 整页装配。dateStr 由调用方传入而不是这里取 new Date()：
 * 客户端组件在服务端也会渲染一遍，就地取时间会撞出 hydration 不一致。
 */
export function buildPaper(
  src: string,
  imgs: TrayImage[],
  meta: PaperMeta,
  dateStr: string
): string {
  const { html, heads } = toBody(src, imgs);
  const buyer = meta.buyer.trim();
  let out = "";

  if (buyer)
    out += `<div class="tp-wm">${Array(56).fill(`<span>${esc(buyer)}</span>`).join("")}</div>`;

  out += '<div class="tp-body">';

  if (meta.cover)
    out +=
      `<section class="tp-cover"><div class="tp-tag">${esc(meta.author)}</div>` +
      `<h1>${esc(meta.title)}</h1><p class="tp-sub">${esc(meta.sub)}</p>` +
      `<div class="tp-meta"><b>${esc(meta.ver)}</b> · ${esc(dateStr)}` +
      (buyer ? ` · 授权给 <b>${esc(buyer)}</b>` : "") +
      `</div></section>`;

  if (meta.toc && heads.length)
    out +=
      `<nav class="tp-toc"><h4>目录</h4><ol>` +
      heads.map((h, i) => `<li><a href="#tph${i}">${esc(h)}</a></li>`).join("") +
      `</ol></nav>`;

  out += html;

  if (meta.note.trim())
    out += `<div class="tp-endnote">${inline(meta.note).replace(/\n/g, "<br>")}</div>`;

  return out + "</div>";
}

/** 文件名清洗：Windows 非法字符一律换下划线 */
export function safeFilename(s: string): string {
  return (s || "教程").replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 60) || "教程";
}

export interface Project {
  src: string;
  imgs: TrayImage[];
  meta: PaperMeta;
}

/**
 * 工程 JSON → 内部结构，兼容独立版装配台（tutorial-packager.html）存的老格式：
 * 老格式的图片字段叫 data（不叫 src），元信息是扁平的 mTitle/oCover 这类前缀键。
 * 这个函数存在的唯一理由是「以前存的工程还能打开」——不做迁移就等于把历史工程作废。
 * 未知/缺失字段一律回落到 EMPTY_META，坏 JSON 不该把编辑器打成空白。
 */
export function parseProject(raw: unknown): Project {
  const d = (raw ?? {}) as Record<string, unknown>;
  const m = (d.meta ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fb: string) => (typeof v === "string" ? v : fb);
  const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);

  const imgs: TrayImage[] = (Array.isArray(d.imgs) ? d.imgs : []).flatMap((x) => {
    const im = (x ?? {}) as Record<string, unknown>;
    const src = str(im.src, "") || str(im.data, ""); // data = 老字段名
    if (!src) return [];
    return [
      {
        name: str(im.name, "图"),
        src,
        cap: str(im.cap, ""),
        // 老格式只存 data:URI；远程图是本版才有的概念，按 src 形态自己判
        remote: typeof im.remote === "boolean" ? im.remote : !src.startsWith("data:"),
      },
    ];
  });

  return {
    src: str(d.src, ""),
    imgs,
    meta: {
      title: str(m.title, str(m.mTitle, EMPTY_META.title)),
      sub: str(m.sub, str(m.mSub, EMPTY_META.sub)),
      author: str(m.author, str(m.mAuthor, EMPTY_META.author)),
      ver: str(m.ver, str(m.mVer, EMPTY_META.ver)),
      buyer: str(m.buyer, str(m.mBuyer, EMPTY_META.buyer)),
      brand: str(m.brand, str(m.mBrand, EMPTY_META.brand)),
      note: str(m.note, str(m.mNote, EMPTY_META.note)),
      cover: bool(m.cover, bool(m.oCover, EMPTY_META.cover)),
      toc: bool(m.toc, bool(m.oToc, EMPTY_META.toc)),
    },
  };
}

/**
 * 删/移图片后重排正文里的 [[n]]。
 * map: 老编号 → 新编号，0 表示该图已删除（标记直接抹掉）；
 * 表里没有的编号原样留着——那是「缺图」占位，不该被悄悄改掉。
 */
export function remapMarkers(src: string, map: Record<number, number>): string {
  return src.replace(/\[\[(\d+)\]\]/g, (m, d: string) => {
    const n = map[Number(d)];
    if (n === 0) return "";
    return n ? `[[${n}]]` : m;
  });
}
