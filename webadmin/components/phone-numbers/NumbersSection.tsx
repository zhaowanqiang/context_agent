"use client";

import { useCallback, useSyncExternalStore } from "react";
import { NUMBER_TYPE_LABEL, phoneNumbers, type PhoneNumberEntry } from "@/data/phone-numbers";
import PhoneDetail from "./PhoneDetail";

/* 哪一条展开，唯一事实来源是地址栏 hash（/numbers#number-{slug}）——与 /cards 同一套做法。
   服务端快照为空 = 不展开，首屏 HTML 与无 hash 访问一致。 */
const HASH_PREFIX = "#number-";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const getHash = () => window.location.hash;
const getServerHash = () => "";

const VERIFIED_OF = (e: PhoneNumberEntry) =>
  Object.values(e.facts).filter((f) => f.status !== "pending").length;

export default function NumbersSection() {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  const openSlug = hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : null;
  const open = phoneNumbers.find((e) => e.slug === openSlug) ?? null;

  const close = useCallback(() => {
    // replaceState 不触发 hashchange，自己广播一次让订阅者重读
    history.replaceState(null, "", window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);

  return (
    <>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {phoneNumbers.map((e) => {
          const verified = VERIFIED_OF(e);
          return (
            <li key={e.slug} className="flex">
              <button
                type="button"
                onClick={() => {
                  window.location.hash = `number-${e.slug}`;
                }}
                aria-haspopup="dialog"
                className="group flex flex-1 flex-col rounded-xl border border-neutral-200 bg-white p-5 text-left transition hover:border-amber-300 hover:shadow-[0_1px_16px_rgba(180,83,9,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-neutral-200 px-2 py-px text-[11.5px] text-neutral-600">
                    {NUMBER_TYPE_LABEL[e.numberType]}
                  </span>
                  {e.status === "pending" && (
                    <span className="rounded-full bg-neutral-100 px-2 py-px text-[11.5px] text-neutral-600">
                      内容整理中
                    </span>
                  )}
                  {e.status === "deprecated" && (
                    <span className="rounded-full bg-neutral-100 px-2 py-px text-[11.5px] text-neutral-600">已停用</span>
                  )}
                </span>
                <span className="mt-3 text-[16.5px] font-semibold leading-snug text-neutral-900 transition group-hover:text-amber-800">
                  {e.carrier}
                </span>
                <span className="mt-1 text-[13px] text-neutral-600">{e.region}</span>
                <span className="mt-4 flex items-baseline justify-between gap-2 border-t border-neutral-200/80 pt-3 text-[12.5px]">
                  <span className="text-neutral-500">
                    已核实 {verified} / {Object.keys(e.facts).length} 项
                  </span>
                  <span className="font-medium text-amber-700">
                    看详情 <span className="inline-block transition group-hover:translate-x-0.5">→</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {open && <PhoneDetail key={open.slug} entry={open} onClose={close} />}
    </>
  );
}
