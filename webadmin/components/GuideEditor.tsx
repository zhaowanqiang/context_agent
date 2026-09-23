"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteGuide,
  publishGuide,
  saveGuide,
  unpublishGuide,
  uploadImage,
} from "@/app/actions/guides";
import { isActive, REFERRAL_CATEGORIES, REFERRALS } from "@/data/referrals";
import { referencedReferralIds } from "@/lib/guideBlocks";
import type { Guide } from "@/lib/guides";
import { IMAGE_SLOT_PREFIX } from "@/lib/xthread";

const input =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-[13px] outline-none focus:border-amber-400";

/** 正文里还没填的配图位编号 */
function unfilledSlots(md: string): number[] {
  const re = new RegExp(`\\]\\(${IMAGE_SLOT_PREFIX}(\\d+)\\)`, "g");
  return [...md.matchAll(re)].map((m) => Number(m[1]));
}

export default function GuideEditor({ guide }: { guide: Guide }) {
  const router = useRouter();
  const [md, setMd] = useState(guide.content_md);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState("");
  const mdRef = useRef<HTMLTextAreaElement>(null);

  const slots = unfilledSlots(md);
  // 正文里已内嵌的返佣位：拿来给出"文末别再挂一遍"的提示，和详情页去重逻辑对齐
  const inlined = referencedReferralIds(md);

  /** 在光标处插入返佣标记。手打 ::referral{id=x} 很容易把大括号或 id 打错，
   *  而打错的后果是那个位在页面上静默消失——所以给按钮，不让人手打。 */
  function insertReferral(id: string) {
    const ta = mdRef.current;
    const marker = `\n\n::referral{id=${id}}\n\n`;
    if (!ta) {
      setMd((cur) => `${cur}${marker}`);
      return;
    }
    const at = ta.selectionStart ?? md.length;
    setMd((cur) => `${cur.slice(0, at)}${marker}${cur.slice(at)}`);
  }

  async function run(fn: () => Promise<{ error?: string; message?: string }>) {
    setPending(true);
    setError(null);
    setMsg(null);
    try {
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        setMsg(r.message ?? "完成");
        router.refresh();
      }
      return r;
    } finally {
      setPending(false);
    }
  }

  async function save(formData: FormData) {
    await run(() => saveGuide(guide.id, formData));
  }

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("先选一张图");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    if (slot) fd.set("slot", slot);
    const r = await run(() => uploadImage(guide.id, fd));
    if (r && !r.error) {
      const withUrl = r as { markdown?: string };
      if (slot && withUrl.markdown) {
        // 服务端已经把占位换掉了，本地正文跟着换，省一次刷新往返
        setMd((cur) => cur.replace(`![配图 ${slot}](${IMAGE_SLOT_PREFIX}${slot})`, withUrl.markdown!));
        setSlot("");
      } else if (withUrl.markdown) {
        setMd((cur) => `${cur}\n\n${withUrl.markdown}\n`);
      }
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <form action={save} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-neutral-600">标题</span>
            <input name="title" defaultValue={guide.title} required className={`mt-1 ${input}`} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-neutral-600">
              最后核对 <span className="font-normal text-neutral-400">· 页面顶部会显著标出</span>
            </span>
            <input
              name="verified_at"
              type="date"
              defaultValue={guide.verified_at ?? ""}
              className={`mt-1 ${input}`}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[12px] font-medium text-neutral-600">
            摘要 <span className="font-normal text-neutral-400">· 留空自动取正文首段</span>
          </span>
          <input name="summary" defaultValue={guide.summary ?? ""} className={`mt-1 ${input}`} />
        </label>

        <label className="block">
          <span className="text-[12px] font-medium text-neutral-600">
            封面图 URL <span className="font-normal text-neutral-400">· 列表页卡片用，可空</span>
          </span>
          <input name="cover_url" defaultValue={guide.cover_url ?? ""} className={`mt-1 ${input}`} />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-neutral-600">
              品类 <span className="font-normal text-neutral-400">· /guides 列表按它筛选</span>
            </span>
            <select
              name="category"
              defaultValue={guide.category ?? ""}
              className={`mt-1 ${input}`}
            >
              <option value="">未归类</option>
              {REFERRAL_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="text-[12px] font-medium text-neutral-600">
            文末主推的返佣位{" "}
            <span className="font-normal text-neutral-400">· 整篇读完该开哪个，可多选</span>
          </legend>
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {REFERRALS.map((r) => {
              const live = isActive(r);
              const dupe = inlined.includes(r.id);
              return (
                <label
                  key={r.id}
                  className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px] ${
                    live ? "border-neutral-200" : "border-neutral-200 bg-neutral-50 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="referral_ids"
                    value={r.id}
                    defaultChecked={guide.referral_ids.includes(r.id)}
                    className="mt-0.5 accent-amber-700"
                  />
                  <span className="min-w-0">
                    <span className="text-neutral-800">
                      {r.emoji} {r.name}
                    </span>
                    {!live && (
                      // 注册表里 url/code 都空的占位条目：勾了也不会渲染，发布闸门会拦
                      <span className="ml-1 text-[11px] text-red-700">链接未填</span>
                    )}
                    {dupe && (
                      <span className="ml-1 text-[11px] text-neutral-400">正文已内嵌</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-[12px] font-medium text-neutral-600">正文 markdown</span>
          <textarea
            ref={mdRef}
            name="content_md"
            required
            rows={20}
            value={md}
            onChange={(e) => setMd(e.target.value)}
            className={`mt-1 ${input} font-mono leading-relaxed`}
          />
        </label>

        <div className="rounded-md border border-amber-200/70 bg-amber-50/50 px-3 py-2.5">
          <p className="text-[12px] text-neutral-600">
            在正文光标处插入返佣卡片（渲染成
            <code className="mx-1 rounded bg-white px-1">::referral&#123;id=…&#125;</code>
            标记，读到关键那一步时正好看见）：
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REFERRALS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => insertReferral(r.id)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[12px] text-neutral-700 transition hover:border-amber-300 hover:bg-amber-50"
              >
                {r.emoji} {r.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-neutral-400">
            插入只改了本地正文框，记得点「保存」。
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-800 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? "处理中…" : "保存"}
        </button>
      </form>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-[13px] font-semibold text-neutral-700">配图</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
          图片转存进 Supabase 公开桶，不引 X 的图链——删推或防盗链一开，外链图会整片变空。
        </p>
        {slots.length > 0 ? (
          <p className="mt-2 text-[12px] text-amber-700">
            还有 {slots.length} 个配图位没填：{slots.join("、")}。发布会被拦住。
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-neutral-400">没有待填的配图位。</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="text-[12px] text-neutral-600 file:mr-2 file:rounded-md file:border file:border-neutral-300 file:bg-neutral-50 file:px-2 file:py-1 file:text-[12px]"
          />
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-[12px]"
          >
            <option value="">追加到正文末尾</option>
            {slots.map((n) => (
              <option key={n} value={n}>
                填进配图位 {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={upload}
            disabled={pending}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12.5px] font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
          >
            上传
          </button>
        </div>
        <p className="mt-2 text-[11.5px] text-neutral-400">
          上传只改了本地正文框，记得点上面的「保存」。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4">
        {guide.status === "published" ? (
          <>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11.5px] font-medium text-green-800">
              已上站
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => unpublishGuide(guide.id))}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-[12.5px] transition hover:bg-neutral-50 disabled:opacity-60"
            >
              下架回草稿
            </button>
          </>
        ) : (
          <>
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] font-medium text-neutral-600">
              草稿
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => publishGuide(guide.id))}
              className="rounded-md bg-amber-700 px-3 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-amber-800 disabled:opacity-60"
            >
              发布到 /guides
            </button>
          </>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            const r = await run(() => deleteGuide(guide.id));
            if (r && !r.error) router.push("/import");
          }}
          className="ml-auto rounded-md border border-red-200 px-3 py-1.5 text-[12.5px] text-red-700 transition hover:bg-red-50 disabled:opacity-60"
        >
          删除
        </button>
      </div>

      {error && <p className="text-[12.5px] text-red-700">{error}</p>}
      {msg && <p className="text-[12.5px] text-green-700">{msg}</p>}
    </div>
  );
}
