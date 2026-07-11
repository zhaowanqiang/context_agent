"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  abortRun,
  autoRunToDraft,
  confirmOutline,
  generateOutline,
  markPublished,
  regenerateDraft,
  resetStuckRun,
  saveDraftFinal,
  type ActionResult,
} from "@/app/actions/runs";
import { saveToFewshot } from "@/app/actions/fewshot";
import { WECHAT_THEMES, renderWechatHtmlThemed } from "@/lib/wechat/wenyan";
import CopyRichTextButton from "./CopyRichTextButton";
import Markdown from "./Markdown";
import WeChatPreview from "./WeChatPreview";
import type { Run } from "@/lib/types";

function Btn({
  onClick,
  children,
  variant = "primary",
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const cls = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-700",
    secondary: "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
        <h2 className="text-[15px] font-semibold text-neutral-800">{title}</h2>
        {aside}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/** Gate 结果：先给一眼可见的判定横幅，正文按 markdown 排版 */
function ChecklistPanel({ text }: { text: string }) {
  const redlineFailed = text.includes("必须删除");
  const fabricated = text.includes("素材无依据");
  const passed = !redlineFailed && text.includes("红线检查：通过");
  // 质量自检分（confirmOutline 拼进 checklist 头部；低分在自动产线里已触发过一次重写）
  const quality = text.match(/【质量自检】([\d.]+)\/10/)?.[1];
  return (
    <div className="space-y-3">
      {quality && (
        <div
          className={`rounded-md border px-4 py-2.5 text-sm font-medium ${
            Number(quality) >= 8
              ? "border-green-200 bg-green-50 text-green-800"
              : Number(quality) >= 7
                ? "border-neutral-200 bg-neutral-50 text-neutral-700"
                : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          ✎ 质量自检 {quality}/10{Number(quality) < 7 ? "——低于发布线，建议按下方问题清单润色" : ""}
        </div>
      )}
      {redlineFailed && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800">
          ⛔ 红线未通过 —— 下方标「必须删除」的句子处理完才能发布
        </div>
      )}
      {fabricated && (
        <div className="rounded-md border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-800">
          ⚠ 有实测声明在素材里找不到依据 —— 这些「我测了」是编的，补测或删改后才能发布
        </div>
      )}
      {passed && !fabricated && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800">
          ✓ 红线与实测声明核查通过 —— 发布前把「待核实清单」逐条核掉
        </div>
      )}
      <Markdown text={text} />
    </div>
  );
}

export default function RunWorkbench({ run, fewshotFile = null }: { run: Run; fewshotFile?: string | null }) {
  // 不用 useTransition：Next 16 捆绑的 React 19 有 transition 竞态 bug（vercel/next.js#88767）——
  // action resolve 后 replay 丢失，isPending 卡死、状态流转不上屏
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outline, setOutline] = useState(run.outline_final ?? run.outline_generated ?? "");
  const [draftFinal, setDraftFinal] = useState(run.draft_final ?? run.draft ?? "");
  const [savedTip, setSavedTip] = useState<string | null>(null);
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const router = useRouter();

  // 生成是在别处发起的（产线/另一个标签页/中途关过页面）时，本页不会自己更新——
  // 每 5s 拉一次最新状态。本页自己发起的操作（isPending）不轮询，避免打断进行中的 transition。
  const inFlight = ["outlining", "drafting", "gating"].includes(run.status);
  useEffect(() => {
    if (!inFlight || isPending) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [inFlight, isPending, router]);

  const act = async (fn: () => Promise<ActionResult>, tip?: string) => {
    setError(null);
    setSavedTip(null);
    setIsPending(true);
    try {
      const r = await fn();
      if (r.error) setError(r.error);
      else setSavedTip(r.message ?? tip ?? null); // 服务端带回的话（如自动喂库结果）优先
      // action 内的 revalidatePath 不可靠（同一 bug 的另一面），显式刷新拿最新状态
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const busy = isPending || ["outlining", "drafting", "gating"].includes(run.status);
  const materialOpen = ["created", "failed"].includes(run.status);

  // 公众号轨道：排版 HTML 跟随润色稿实时渲染（wenyan 多主题，异步 + 300ms 防抖）。
  // 主题偏好记在 localStorage，选一次全站生效；预览 select 只在客户端异步出 HTML 后
  // 才渲染，所以惰性初始化读 localStorage 不会产生 hydration 不一致。
  const [wechatTheme, setWechatTheme] = useState(() => {
    if (typeof window === "undefined") return "default";
    const saved = localStorage.getItem("wechat-theme");
    return saved && WECHAT_THEMES.some((t) => t.id === saved) ? saved : "default";
  });
  const [wechatHtml, setWechatHtml] = useState<string | null>(null);
  useEffect(() => {
    let stale = false;
    const t = setTimeout(async () => {
      const html =
        run.track === "wechat" && draftFinal ? await renderWechatHtmlThemed(draftFinal, wechatTheme) : null;
      if (!stale) setWechatHtml(html);
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [run.track, draftFinal, wechatTheme]);
  const pickTheme = (id: string) => {
    setWechatTheme(id);
    localStorage.setItem("wechat-theme", id);
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{error}</div>
      )}
      {run.error && run.status === "failed" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          上次失败：{run.error}
        </div>
      )}
      {savedTip && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">{savedTip}</div>
      )}
      {busy && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
          生成进行中（强模型 + 思考，可能 1–3 分钟）……别关页面，也别重复点按钮。
        </div>
      )}

      {/* 原始素材：只在起点展开，之后折叠让位给正文 */}
      <details
        open={materialOpen}
        className="group rounded-lg border border-neutral-200 bg-white shadow-sm"
      >
        <summary className="cursor-pointer select-none px-5 py-3 text-[15px] font-semibold text-neutral-800 hover:bg-neutral-50">
          原始素材
          <span className="ml-2 text-xs font-normal text-neutral-400 group-open:hidden">（点击展开）</span>
        </summary>
        <div className="border-t border-neutral-100 px-5 py-4">
          <div className="plain-text">{run.material}</div>
        </div>
      </details>

      {/* created / failed：一键直通 或 分步走 */}
      {["created", "failed"].includes(run.status) && (
        <div className="flex flex-wrap items-center gap-2">
          <Btn onClick={() => act(() => autoRunToDraft(run.id))} disabled={isPending}>
            {isPending ? "全自动生成中…（约 3–5 分钟）" : "⚡ 一键到成稿（大纲不经确认）"}
          </Btn>
          <Btn variant="secondary" onClick={() => act(() => generateOutline(run.id))} disabled={isPending}>
            {isPending ? "生成中…" : "分步走：先出大纲让我改"}
          </Btn>
          <Btn variant="danger" onClick={() => act(() => abortRun(run.id))} disabled={isPending}>
            放弃
          </Btn>
        </div>
      )}

      {/* outline_review：人工闸口 */}
      {run.status === "outline_review" && (
        <Section title="大纲 · 人工闸口" aside={<span className="text-xs text-neutral-400">直接改，改完确认</span>}>
          <textarea
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            rows={20}
            className="md-editor w-full rounded-md border border-neutral-300 p-4 focus:border-neutral-500 focus:outline-none"
          />
          <div className="mt-4 flex gap-2">
            <Btn onClick={() => act(() => confirmOutline(run.id, outline))} disabled={isPending}>
              {isPending ? "成稿生成中…（约 2–4 分钟）" : "确认大纲 → 生成成稿 + Gate"}
            </Btn>
            <Btn variant="danger" onClick={() => act(() => abortRun(run.id))} disabled={isPending}>
              放弃
            </Btn>
          </div>
        </Section>
      )}

      {/* 卡死重置 */}
      {["outlining", "drafting", "gating"].includes(run.status) && !isPending && (
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>如果这个状态卡了很久（比如中途关过页面）：</span>
          <Btn variant="secondary" onClick={() => act(() => resetStuckRun(run.id))}>
            重置重试
          </Btn>
        </div>
      )}

      {/* draft_review / published：成稿 + checklist */}
      {["draft_review", "published"].includes(run.status) && (
        <>
          {run.checklist && (
            <Section title="Gate · 红线检查 + 待核实清单">
              <ChecklistPanel text={run.checklist} />
            </Section>
          )}
          <Section
            title={run.status === "published" ? "成稿（已发布）" : "成稿 · 润色与发布"}
            aside={
              run.status === "draft_review" ? (
                <div className="flex rounded-md border border-neutral-200 text-xs">
                  <button
                    onClick={() => setShowDraftPreview(false)}
                    className={`rounded-l-md px-3 py-1 ${!showDraftPreview ? "bg-neutral-900 text-white" : "bg-white text-neutral-500 hover:bg-neutral-50"}`}
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setShowDraftPreview(true)}
                    className={`rounded-r-md px-3 py-1 ${showDraftPreview ? "bg-neutral-900 text-white" : "bg-white text-neutral-500 hover:bg-neutral-50"}`}
                  >
                    阅读预览
                  </button>
                </div>
              ) : undefined
            }
          >
            {run.status === "draft_review" ? (
              <>
                {/* 手机：编辑区在上、公众号预览在下；lg 起左右并排 */}
                <div className="flex flex-col gap-5 lg:flex-row">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="text-xs text-neutral-400">
                      {showDraftPreview ? "校对稿（纯文字，不代表公众号排版）" : "编辑稿（markdown）"}
                    </div>
                    {showDraftPreview ? (
                      <div className="rounded-md border border-neutral-100 bg-neutral-50/50 px-5 py-4">
                        <Markdown text={draftFinal} />
                      </div>
                    ) : (
                      <textarea
                        value={draftFinal}
                        onChange={(e) => setDraftFinal(e.target.value)}
                        rows={26}
                        className="md-editor rounded-md border border-neutral-300 p-4 focus:border-neutral-500 focus:outline-none"
                      />
                    )}
                  </div>
                  {wechatHtml && (
                    <div className="flex w-full max-w-[375px] shrink-0 flex-col gap-2 self-center lg:self-auto">
                      <select
                        value={wechatTheme}
                        onChange={(e) => pickTheme(e.target.value)}
                        className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-700 focus:border-neutral-500 focus:outline-none"
                        title="公众号排版主题"
                      >
                        {WECHAT_THEMES.map((t) => (
                          <option key={t.id} value={t.id}>
                            排版主题：{t.name}
                          </option>
                        ))}
                      </select>
                      <WeChatPreview html={wechatHtml} />
                      <div className="text-center text-xs text-neutral-400">
                        公众号实际排版 —— 「复制富文本」就是这个样式
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Btn
                    variant="secondary"
                    onClick={() => act(() => saveDraftFinal(run.id, draftFinal), "润色稿已保存")}
                    disabled={isPending}
                  >
                    保存润色稿
                  </Btn>
                  {wechatHtml ? (
                    <CopyRichTextButton
                      html={wechatHtml}
                      markdown={draftFinal}
                      onCopied={() => act(() => saveDraftFinal(run.id, draftFinal))}
                    />
                  ) : (
                    <Btn
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(draftFinal);
                        setSavedTip("纯文本已复制");
                      }}
                    >
                      复制纯文本
                    </Btn>
                  )}
                  <Btn variant="secondary" onClick={() => act(() => regenerateDraft(run.id))} disabled={isPending}>
                    {isPending ? "重跑中…" : "不满意，重跑成稿"}
                  </Btn>
                  <Btn
                    onClick={() =>
                      act(
                        async () => {
                          const save = await saveDraftFinal(run.id, draftFinal);
                          if (save.error) return save;
                          return markPublished(
                            run.id,
                            run.track === "wechat" ? "wechat_clipboard" : "x_manual",
                            wechatHtml
                          );
                        },
                        "已标记发布"
                      )
                    }
                    disabled={isPending}
                  >
                    标记已发布
                  </Btn>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {fewshotFile ? (
                    <>
                      <span className="rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800">
                        ✓ 已在范例库：{fewshotFile}
                      </span>
                      <Link href={`/agent/${run.track}/fewshot`} className="text-xs text-amber-700 hover:underline">
                        查看范例库与质量走势 →
                      </Link>
                    </>
                  ) : (
                    <>
                      <Btn
                        variant="secondary"
                        onClick={() =>
                          act(async () => {
                            const r = await saveToFewshot(run.id);
                            if (r.error) return { error: r.error };
                            setSavedTip(r.message ?? "已入库");
                            return {};
                          })
                        }
                        disabled={isPending}
                      >
                        ★ 存入 few-shot 范例库（喂回我的语气）
                      </Btn>
                      <span className="text-xs text-neutral-400">
                        发布时质检达标会自动入库；这篇还不在库里——效果好可手动存入。
                        <Link href={`/agent/${run.track}/fewshot`} className="ml-1 text-amber-700 hover:underline">
                          查看范例库 →
                        </Link>
                      </span>
                    </>
                  )}
                </div>
                <Markdown text={run.draft_final ?? run.draft ?? ""} />
              </>
            )}
          </Section>
        </>
      )}

      {run.status === "aborted" && (
        <p className="text-sm text-neutral-500">本次运行已放弃。素材和已产出的中间结果保留在上方。</p>
      )}
    </div>
  );
}
