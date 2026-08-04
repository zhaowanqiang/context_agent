"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { inlineRemoteImage, loadGuideSource } from "@/app/actions/packager";
import { PAPER_CSS, standaloneDoc } from "@/lib/packagerPaper";
import {
  buildPaper,
  EMPTY_META,
  parseProject,
  remapMarkers,
  safeFilename,
  type PaperMeta,
  type TrayImage,
} from "@/lib/packagerRender";

/* 图文教程装配台：正文 + 图片 → 带封面/目录/购买者水印的可售卖成品。
   全程在浏览器里跑，图片不落库——成品是要卖的，中间态没有存到服务器的理由。
   唯二的服务端往返：从站内教程库载入正文，以及把远程图抓成 data:URI。 */

export interface GuidePick {
  id: string;
  title: string;
  status: "draft" | "published";
}

const SAMPLE = `## 开户前先确认三件事

这一步很多人跳过，结果卡在最后一关。

- 护照有效期还剩多久
- 地址证明用哪份
- 手机号能不能收验证码

[[1]]

> 提示：截图里红框那一栏必须和地址证明完全一致。

## 填写申请表

打开官网，点右上角 **Open Account**。

[[2]]

填完拉到底提交，一般 1-3 个工作日出结果。

---

## 常见拒绝原因`;

/** 贴进 X 文章页控制台跑的抓取脚本：正文进剪贴板，图片按 01 02 03 顺序下载 */
const GRABBER = `(async()=>{
 const root=document.querySelector('article')||document.body;
 const out=[];let n=0;const urls=[];
 const walk=el=>{for(const c of el.childNodes){
   if(c.nodeType===1){
     if(c.tagName==='IMG'){
       const s=c.currentSrc||c.src||'';
       if(/pbs\\.twimg\\.com\\/media/.test(s)){n++;urls.push(s.split('?')[0].split('&')[0]+'?format=jpg&name=orig');out.push('\\n\\n[['+n+']]\\n\\n');}
       continue;
     }
     if(/^(P|DIV|SPAN|LI|H1|H2|H3|BLOCKQUOTE|BR)$/.test(c.tagName)){
       if(c.tagName==='BR'){out.push('\\n');continue;}
       const only=[...c.childNodes].every(x=>x.nodeType===3);
       if(only){const t=c.innerText.trim();if(t)out.push('\\n\\n'+t);continue;}
     }
     walk(c);
   } else if(c.nodeType===3){const t=c.textContent.trim();if(t)out.push(t);}
 }};
 walk(root);
 const md=out.join('').replace(/\\n{3,}/g,'\\n\\n').trim();
 console.log('%c已提取 '+n+' 张图','color:#0a0');
 await navigator.clipboard.writeText(md).catch(()=>{});
 console.log(md);
 for(let i=0;i<urls.length;i++){
   try{const b=await(await fetch(urls[i])).blob();
     const a=document.createElement('a');a.href=URL.createObjectURL(b);
     a.download=String(i+1).padStart(2,'0')+'.jpg';a.click();
     await new Promise(r=>setTimeout(r,350));
   }catch(e){console.warn('下不动，手动右键存：',urls[i]);}
 }
})()`;

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error(`读不出 ${file.name}`));
    r.readAsDataURL(file);
  });
}

function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4_000);
}

const btn =
  "rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[12.5px] text-neutral-700 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50";
const btnGo =
  "rounded-lg border border-amber-600 bg-amber-600 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50";
const field =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13.5px] text-neutral-800 outline-none transition-colors focus:border-amber-500";
const labelCls = "mb-1 block text-[12px] text-neutral-500";

export default function TutorialPackager({
  guides,
  today,
}: {
  guides: GuidePick[];
  /** 封面日期由服务端按 Asia/Shanghai 算好传下来：在这里取 new Date() 会撞
   *  hydration 不一致，而服务端不指定时区在 UTC 机器上又会差一天 */
  today: string;
}) {
  const [src, setSrc] = useState(SAMPLE);
  const [imgs, setImgs] = useState<TrayImage[]>([]);
  const [meta, setMeta] = useState<PaperMeta>(EMPTY_META);
  const [hot, setHot] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickedGuide, setPickedGuide] = useState("");

  const taRef = useRef<HTMLTextAreaElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const projRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof PaperMeta>(k: K, v: PaperMeta[K]) =>
    setMeta((m) => ({ ...m, [k]: v }));

  const paperHtml = useMemo(
    () => buildPaper(src, imgs, meta, today),
    [src, imgs, meta, today]
  );

  const remoteCount = imgs.filter((i) => i.remote).length;

  /* ---------- 图片托盘 ---------- */

  const addFiles = useCallback(async (files: File[]) => {
    const fs = files
      .filter((f) => f.type.startsWith("image/"))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!fs.length) return;
    try {
      const added = await Promise.all(
        fs.map(async (f) => ({ name: f.name, src: await readAsDataURL(f), cap: "" }))
      );
      setImgs((cur) => [...cur, ...added]);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }, []);

  /** 移动/删除都要顺手改正文里的 [[n]]，否则标记会指到别的图上 */
  const move = (from: number, to: number) => {
    if (to < 0 || to >= imgs.length) return;
    const order = imgs.map((_, i) => i);
    order.splice(to, 0, order.splice(from, 1)[0]);
    const map: Record<number, number> = {};
    order.forEach((old, ni) => (map[old + 1] = ni + 1));
    setImgs(order.map((i) => imgs[i]));
    setSrc((s) => remapMarkers(s, map));
  };

  const del = (i: number) => {
    const map: Record<number, number> = {};
    imgs.forEach((_, k) => {
      if (k < i) map[k + 1] = k + 1;
      else if (k > i) map[k + 1] = k;
    });
    map[i + 1] = 0; // 0 = 标记直接抹掉
    setImgs(imgs.filter((_, k) => k !== i));
    setSrc((s) => remapMarkers(s, map));
  };

  const insertMarker = (n: number) => {
    const ta = taRef.current;
    const tag = `\n\n[[${n}]]\n\n`;
    if (!ta) {
      setSrc((s) => s + tag);
      return;
    }
    const a = ta.selectionStart;
    const b = ta.selectionEnd;
    const next = src.slice(0, a) + tag + src.slice(b);
    setSrc(next);
    // 光标落到插入内容之后：setState 后 DOM 还没更新，等一帧
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = a + tag.length;
    });
  };

  /* ---------- 站内教程 ---------- */

  const loadGuide = async () => {
    if (!pickedGuide) return;
    setBusy("载入教程…");
    setNotice(null);
    try {
      const r = await loadGuideSource(pickedGuide);
      if (!r.ok) {
        setNotice(`载入失败：${r.error}`);
        return;
      }
      setSrc(r.markdown);
      setImgs(r.images);
      setMeta((m) => ({ ...m, title: r.title }));
      setNotice(
        `已载入《${r.title}》：${r.images.length} 张图（远程链接，导出前建议内联）` +
          (r.skippedSlots ? ` · 略过 ${r.skippedSlots} 个未填的配图位` : "")
      );
    } catch (e) {
      setNotice(`载入失败：${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  /** 远程图逐张抓成 data:URI —— 导出的单文件 HTML 才真的自带图 */
  const inlineAll = async () => {
    const targets = imgs.map((im, i) => ({ im, i })).filter((x) => x.im.remote);
    if (!targets.length) return;
    let done = 0;
    const failed: string[] = [];
    setNotice(null);
    for (const { im, i } of targets) {
      setBusy(`内联远程图 ${done + 1}/${targets.length}…`);
      try {
        const r = await inlineRemoteImage(im.src);
        if (r.ok && r.dataUri) {
          const uri = r.dataUri;
          setImgs((cur) =>
            cur.map((c, k) => (k === i ? { ...c, src: uri, remote: false } : c))
          );
          done++;
        } else {
          failed.push(`${im.name}（${r.error}）`);
        }
      } catch (e) {
        failed.push(`${im.name}（${(e as Error).message}）`);
      }
    }
    setBusy(null);
    setNotice(
      failed.length
        ? `内联 ${done} 张，失败 ${failed.length} 张：${failed.join("、")}`
        : `已内联 ${done} 张图，现在导出的 HTML 是真·单文件了`
    );
  };

  /* ---------- 导出 ---------- */

  const exportHTML = () => {
    const doc = standaloneDoc(meta.title, meta.brand, buildPaper(src, imgs, meta, today));
    download(safeFilename(meta.title) + ".html", new Blob([doc], { type: "text/html" }));
  };

  /**
   * 打印走隐藏 iframe 里的独立文档，而不是 window.print() 打当前页：
   * 当前页外面裹着全站 header/footer/导航，要打干净就得往 globals.css 塞一堆
   * @media print 的 display:none，那是为一个页面污染全站样式表。
   * iframe 里装的正是导出的那份 HTML——打印和导出共用同一份产物，两条路径不会分叉。
   */
  const printPDF = () => {
    const doc = standaloneDoc(meta.title, meta.brand, buildPaper(src, imgs, meta, today));
    const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
    frame.src = url; // blob: 继承本页 origin，contentWindow 可访问
    const cleanup = () => {
      URL.revokeObjectURL(url);
      frame.remove();
    };
    frame.onload = () => {
      const w = frame.contentWindow;
      if (!w) return cleanup();
      w.addEventListener("afterprint", () => setTimeout(cleanup, 500));
      w.focus();
      w.print();
      // afterprint 在个别浏览器不触发，兜一个长超时，别把 blob 泄在内存里
      setTimeout(cleanup, 120_000);
    };
    document.body.appendChild(frame);
  };

  const saveProject = () => {
    const data = { v: 1, src, imgs, meta };
    download(
      safeFilename(meta.title) + ".json",
      new Blob([JSON.stringify(data)], { type: "application/json" })
    );
  };

  const loadProject = async (input: HTMLInputElement) => {
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    try {
      // parseProject 兼容独立版装配台存的老格式，历史工程照样打得开
      const p = parseProject(JSON.parse(await f.text()));
      setSrc(p.src);
      setImgs(p.imgs);
      setMeta(p.meta);
      setNotice(`已打开工程：${f.name}（${p.imgs.length} 张图）`);
    } catch {
      setNotice("这个文件读不出来，确认是装配台保存的 .json");
    }
  };

  const copyGrabber = async () => {
    try {
      await navigator.clipboard.writeText(GRABBER);
      setNotice(
        "抓取脚本已复制。到 X 文章页按 F12 打开控制台粘贴回车：正文（含 [[1]] 标记）进剪贴板，图片按 01 02 03 顺序自动下载。"
      );
    } catch {
      window.prompt("手动复制这段脚本：", GRABBER);
    }
  };

  /* ---------- 渲染 ---------- */

  return (
    <div className="space-y-4">
      {/* 纸页样式：只作用于 .tp-paper 子树，注入到后台页面不影响任何站内元素 */}
      <style>{PAPER_CSS}</style>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={copyGrabber}>
          复制 X 抓取脚本
        </button>
        <button type="button" className={btn} onClick={saveProject}>
          保存工程
        </button>
        <button type="button" className={btn} onClick={() => projRef.current?.click()}>
          打开工程
        </button>
        <span className="flex-1" />
        <button type="button" className={btn} onClick={exportHTML}>
          导出单文件 HTML
        </button>
        <button type="button" className={btnGo} onClick={printPDF}>
          导出 PDF
        </button>
        <input
          ref={projRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => loadProject(e.currentTarget)}
        />
      </div>

      {(busy || notice) && (
        <p
          className={`rounded-lg border px-3 py-2 text-[12.5px] ${
            busy
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-neutral-200 bg-neutral-50 text-neutral-600"
          }`}
        >
          {busy ?? notice}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">
        {/* ── 左：装配区 ── */}
        <div className="space-y-6">
          <section>
            <Eyebrow n="1" text="正文" />
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <select
                className={`${field} h-9 flex-1 py-0`}
                value={pickedGuide}
                onChange={(e) => setPickedGuide(e.target.value)}
              >
                <option value="">从站内教程载入…</option>
                {guides.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.status === "draft" ? "［草稿］" : ""}
                    {g.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={btn}
                onClick={loadGuide}
                disabled={!pickedGuide || busy !== null}
              >
                载入
              </button>
            </div>
            <textarea
              ref={taRef}
              value={src}
              spellCheck={false}
              onChange={(e) => setSrc(e.target.value)}
              placeholder="把 X 文章正文粘进来。用 ## 开头写小标题，用 [[1]] 这样的标记放图片。"
              className={`${field} min-h-[340px] resize-y whitespace-pre-wrap font-mono text-[13.5px] leading-[1.75]`}
            />
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-neutral-400">
              <Key k="##" v="小标题" />
              <Key k="###" v="三级标题" />
              <Key k="-" v="列表" />
              <Key k=">" v="提示框" />
              <Key k="**粗**" v="" />
              <Key k="`码`" v="" />
              <Key k="---" v="分页" />
              <Key k="[[3]]" v="第 3 张图" />
            </p>
          </section>

          <section>
            <Eyebrow n="2" text="图片" />
            <div
              role="button"
              tabIndex={0}
              onClick={() => pickRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && pickRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setHot(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setHot(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setHot(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setHot(false);
                addFiles([...e.dataTransfer.files]);
              }}
              className={`cursor-pointer rounded-xl border-[1.5px] border-dashed px-4 py-6 text-center text-[12.5px] transition-colors ${
                hot
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-neutral-300 bg-white text-neutral-400 hover:border-neutral-400"
              }`}
            >
              拖图片进来，或点击选择。按文件名排序，建议存成 01 02 03…
            </div>
            <input
              ref={pickRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addFiles([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />

            {imgs.length > 0 && (
              <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2.5">
                {imgs.map((im, i) => (
                  <div
                    key={`${im.name}-${i}`}
                    className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
                  >
                    {/* 托盘缩略图是 data:URI / 用户自己库里的图，next/image 在这里没有用武之地 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.src} alt="" className="block h-[74px] w-full bg-neutral-100 object-cover" />
                    <button
                      type="button"
                      title="插入到光标处"
                      onClick={() => insertMarker(i + 1)}
                      className="w-full px-2 pt-1.5 pb-1 text-left font-mono text-[11px] font-semibold text-amber-700 hover:text-amber-900"
                    >
                      [[{i + 1}]]
                      {im.remote && <span className="ml-1 font-sans text-neutral-400">远程</span>}
                    </button>
                    <input
                      value={im.cap}
                      placeholder="图注（可选）"
                      onChange={(e) => {
                        const cap = e.target.value;
                        setImgs((cur) => cur.map((c, k) => (k === i ? { ...c, cap } : c)));
                      }}
                      className="w-full border-t border-neutral-200 bg-transparent px-2 py-1 text-[11px] text-neutral-600 outline-none placeholder:text-neutral-300 focus:bg-amber-50/50"
                    />
                    <div className="flex gap-1 px-1.5 pb-1.5 pt-1">
                      <TrayBtn onClick={() => move(i, i - 1)} label="←" />
                      <TrayBtn onClick={() => move(i, i + 1)} label="→" />
                      <TrayBtn onClick={() => del(i)} label="删" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-400">
              <span>点编号插入到光标处。左右键调顺序，正文里的标记会自动跟着改。</span>
              {remoteCount > 0 && (
                <button
                  type="button"
                  onClick={inlineAll}
                  disabled={busy !== null}
                  className="text-amber-700 underline underline-offset-2 hover:text-amber-900 disabled:opacity-50"
                >
                  内联 {remoteCount} 张远程图
                </button>
              )}
            </div>
            {remoteCount > 0 && (
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
                「远程」= 图还挂在 Supabase 公开桶上。打印 PDF 不受影响，但导出的单文件 HTML
                得联网才看得到图——要发给买家就先内联。
              </p>
            )}
          </section>

          <section>
            <Eyebrow n="3" text="成品信息" />
            <div className="space-y-3">
              <div>
                <label className={labelCls}>标题</label>
                <input className={field} value={meta.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>副标题</label>
                <input className={field} value={meta.sub} onChange={(e) => set("sub", e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>作者 / 频道</label>
                  <input className={field} value={meta.author} onChange={(e) => set("author", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>版本</label>
                  <input className={field} value={meta.ver} onChange={(e) => set("ver", e.target.value)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>购买者水印（留空则不加）</label>
                  <input
                    className={field}
                    placeholder="buyer@mail.com"
                    value={meta.buyer}
                    onChange={(e) => set("buyer", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>成品主色</label>
                  <input
                    type="color"
                    className="h-[38px] w-full rounded-lg border border-neutral-200 bg-white p-1"
                    value={meta.brand}
                    onChange={(e) => set("brand", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>页尾声明</label>
                <textarea
                  rows={3}
                  className={`${field} resize-y`}
                  value={meta.note}
                  onChange={(e) => set("note", e.target.value)}
                />
              </div>
              <div className="flex gap-5 text-[13px] text-neutral-700">
                <Check checked={meta.cover} onChange={(v) => set("cover", v)} label="生成封面页" />
                <Check checked={meta.toc} onChange={(v) => set("toc", v)} label="生成目录" />
              </div>
            </div>
          </section>
        </div>

        {/* ── 右：纸页预览 ── */}
        <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto">
          <div className="rounded-xl bg-neutral-200/60 p-3 sm:p-4">
            <div
              className="tp-paper rounded-sm px-6 py-8 shadow-sm sm:px-12 sm:py-12"
              style={{ "--tp-brand": meta.brand } as React.CSSProperties}
              dangerouslySetInnerHTML={{ __html: paperHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Eyebrow({ n, text }: { n: string; text: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
      <span className="text-amber-600">{n}</span>
      {text}
      <span className="h-px flex-1 bg-neutral-200" />
    </div>
  );
}

function Key({ k, v }: { k: string; v: string }) {
  return (
    <span>
      <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[11px] text-amber-700">{k}</code>
      {v && <span className="ml-1">{v}</span>}
    </span>
  );
}

function TrayBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded border border-neutral-200 py-0.5 text-[11px] text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-800"
    >
      {label}
    </button>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-amber-600"
      />
      {label}
    </label>
  );
}
