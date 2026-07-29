"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/decider/AuthProvider";
import AuthForm from "@/components/decider/AuthForm";
import type { Tier } from "@/lib/decider/entitlements";
import { track } from "@/lib/track";

// 一个可购买的档位(由服务端算好传进来,面板只负责展示和触发)
export interface UnlockOffer {
  tier: Exclude<Tier, "free">;
  label: string; // 按钮文案,如「解锁完整版(实操 + 避坑)」
  price_cny: number;
  /** 划线原价(首发优惠期传入,展示删除线) */
  list_price_cny?: number;
}

interface Props {
  guideId: string;
  offers: UnlockOffer[];
  /** 服务端探测到 CREEM_API_KEY 才为 true。false 时不给「购买」按钮——
   *  没有 key 建单必然失败，让用户点了才看到「请稍后再试」是骗人。
   *  此时把人导去仍在运行的独立站买，两站同一个 Supabase 项目，解锁状态互通。 */
  paymentsEnabled: boolean;
}

/* 付费墙曝光去重：一个教程页会渲染两块付费墙（逐步实操 + 避坑清单），
   但对漏斗而言「这个访客看到了付费墙」只该算一次——否则分母翻倍，
   转化率恒偏低一半。键里带 pathname，换教程页能重新计数；
   同一会话内回到同一页不再重复计（略偏保守，好过虚高）。
   不用模块级变量赋值，避免 Next 16 的 react-hooks/immutability 规则。 */
const seenPaywall = new Set<string>();

/** 支付未接入时的替代面板：说清楚状况 + 给一条真能买到的路 */
function BuyElsewhere({ guideId }: { guideId: string }) {
  return (
    <>
      <a
        href={`https://decider.zynqorw.com/guide/${guideId}`}
        target="_blank"
        rel="noreferrer"
        // 迁移期这条是唯一真能付钱的路，点击照样算购买意向
        onClick={() => track("buy_click", { target: guideId, meta: { via: "elsewhere" } })}
        className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700"
      >
        前往购买解锁 ↗
      </a>
      <p className="max-w-xs text-center text-xs leading-relaxed text-slate-400">
        本站支付通道正在迁移，暂由 decider.zynqorw.com 收单。
        两处账号与已购记录互通，买完回这里登录即可查看。
      </p>
    </>
  );
}

// 付费墙遮罩上的解锁面板:
//   未登录        → 引导登录/注册(登录成功后 AuthProvider 会 router.refresh(),服务端重新判定)
//   已登录未购买  → 展示各档购买按钮(真实支付第 4 步接 MoR,这里是占位)
//   开发模式      → 额外提供「模拟购买」直接写 purchases 表,联调解锁链路
export default function UnlockPanel({ guideId, offers, paymentsEnabled }: Props) {
  const { user, loading, supabase } = useAuth();
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  // 付费墙曝光：本组件只在未解锁时（LockedCard 内）渲染，挂载即等于访客看到了墙。
  // 配合 buy_click 就是漏斗的两端——「多少人走到付费墙前掉头走了」。
  useEffect(() => {
    const key = `${pathname}::${guideId}`;
    if (seenPaywall.has(key)) return;
    seenPaywall.add(key);
    track("paywall_view", { target: guideId });
  }, [guideId, pathname]);

  // 首次拉取 session 期间不闪「未登录」
  if (loading) {
    return <span className="text-xs text-slate-400">…</span>;
  }

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowLogin(true)}
          className={
            paymentsEnabled
              ? "rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700"
              : "rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          }
        >
          {paymentsEnabled ? "登录后购买解锁" : "已购买过？登录查看"}
        </button>
        <p className="text-xs text-slate-400">已购买过?登录后自动恢复解锁状态</p>
        {/* 支付未接入时，未登录用户也要有一条能真买到的路 */}
        {!paymentsEnabled && <BuyElsewhere guideId={guideId} />}

        {showLogin && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowLogin(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  登录 / 注册
                </h2>
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  aria-label="关闭"
                  className="rounded-md px-2 text-lg leading-none text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>
              </div>
              <AuthForm onClose={() => setShowLogin(false)} />
            </div>
          </div>
        )}
      </>
    );
  }

  // 真实购买:调用 /api/checkout 建 Creem 支付会话,拿到 URL 后整页跳转过去。
  // 付款成功后 Creem 异步回调 webhook 写 purchases,用户回跳教程页即已解锁。
  async function buy(tier: UnlockOffer["tier"]) {
    setBuying(tier);
    setError(null);
    // 在建单之前打点：这里记的是「购买意向」，付款失败或中途放弃也算——
    // 意向数减去 purchases 实付数，就是支付环节本身漏掉的人
    track("buy_click", { target: guideId, meta: { tier } });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guideId, tier }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        setError(data.error ?? "发起支付失败,请稍后再试");
        setBuying(null);
        return;
      }
      // 跳转到 Creem 托管支付页(不重置 buying,避免跳转前按钮闪回可点状态)。
      // 用 assign() 而非赋值 location.href：行为一致（同样进历史记录），
      // 但不会被 react-hooks/immutability 判成修改组件外部值（Next 16 新增规则）
      window.location.assign(data.url);
    } catch {
      setError("网络错误,请稍后再试");
      setBuying(null);
    }
  }

  // 开发模式下的「模拟购买」:直接往 purchases 插一条自己的记录。
  // 依赖 docs/supabase-purchases.sql 里的 DEV ONLY insert 策略,上线前必须删掉该策略。
  async function simulateBuy(tier: UnlockOffer["tier"]) {
    if (!supabase) return;
    setBuying(tier);
    setError(null);
    const { error } = await supabase
      .from("purchases")
      .insert({ user_id: user!.id, guide_id: guideId, tier });
    setBuying(null);
    if (error) {
      setError(`模拟购买失败:${error.message}`);
      return;
    }
    // 让服务端重新判定解锁状态
    router.refresh();
  }

  if (!paymentsEnabled) return <BuyElsewhere guideId={guideId} />;

  return (
    <>
      {offers.map((offer) => (
        <button
          key={offer.tier}
          type="button"
          disabled={buying !== null}
          onClick={() => buy(offer.tier)}
          className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700 disabled:opacity-60"
        >
          {buying === offer.tier ? (
            "正在跳转支付…"
          ) : (
            <>
              ¥{offer.price_cny} {offer.label}
              {offer.list_price_cny && (
                <del className="ml-1.5 text-xs font-normal text-white/60">¥{offer.list_price_cny}</del>
              )}
            </>
          )}
        </button>
      ))}
      <p className="text-xs text-slate-400">
        一次性付费,永久查看
        {offers.some((o) => o.list_price_cny) && " · 首发优惠价"}
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {process.env.NODE_ENV === "development" && (
        <div className="flex flex-col items-center gap-1">
          {offers.map((offer) => (
            <button
              key={offer.tier}
              type="button"
              disabled={buying !== null}
              onClick={() => simulateBuy(offer.tier)}
              className="text-xs text-amber-600 underline decoration-dotted underline-offset-2 disabled:opacity-50"
            >
              {buying === offer.tier
                ? "写入购买记录中…"
                : `[开发] 模拟购买:${offer.label}`}
            </button>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </>
  );
}
