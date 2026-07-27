import Link from "next/link";
import { getGuide, formatVerified } from "@/data/decider/guides";
import { products } from "@/data/decider/products";
import { renderMarkdown } from "@/lib/decider/markdown";
import AuthBar from "@/components/decider/AuthBar";
import UnlockPanel, { type UnlockOffer } from "@/components/decider/UnlockPanel";
import { createServerSupabase } from "@/lib/decider/supabase-server";
import { fetchGuideTier } from "@/lib/decider/purchases";
import { canView, type Tier } from "@/lib/decider/entitlements";

// 解锁状态因人而异(要读 cookie 里的登录态),必须每次请求动态渲染
export const dynamic = "force-dynamic";

// 教程正文:与 zynqorw 工作台成稿阅读视图同款(.md-body)。
// 只在服务端判定解锁后才渲染付费 markdown——未解锁用户的 HTML 里没有付费内容。
function Reader({ md }: { md: string }) {
  return (
    <article
      className="md-body"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }}
    />
  );
}

// 未解锁时的遮罩卡片。背景是假的骨架条而不是模糊的真实正文——
// 真实付费内容绝不能出现在未解锁用户收到的 HTML 里(blur 挡不住看源码)。
const SKELETON_WIDTHS = ["92%", "78%", "88%", "64%", "85%", "71%", "90%", "58%"];

function LockedCard({
  lines,
  children,
}: {
  lines: number;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none select-none space-y-3 p-4 blur-sm sm:p-6"
      >
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-slate-200"
            style={{ width: SKELETON_WIDTHS[i % SKELETON_WIDTHS.length] }}
          />
        ))}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-white/40 to-white/90 px-4 text-center">
        {children}
      </div>
    </div>
  );
}

export default async function GuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ purchase?: string }>;
}) {
  const { id } = await params;
  const { purchase } = await searchParams;
  const guide = getGuide(id);
  const product = products.find((p) => p.id === id);

  // 支付通道是否可用：没有 CREEM_API_KEY 建单必然失败，此时不展示购买按钮，
  // 改为把用户导向仍在收单的独立站（两处同一个 Supabase，已购记录互通）。
  // 服务端读取，客户端拿不到这个 env——只传布尔值下去。
  const paymentsEnabled = Boolean(process.env.CREEM_API_KEY);

  // 还没写这篇教程:不报 404,显示同样框架的"即将上线"占位页
  if (!guide) {
    return (
      <div className="max-w-2xl py-6 sm:py-10">
        <Link
          href="/decider"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← 返回教程库
        </Link>

        <header className="mb-6 mt-4">
          <p className="text-xs font-medium text-slate-400">实操教程</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {product ? `${product.name} 实操教程` : "实操教程"}
          </h1>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
          <p className="text-base font-medium text-slate-700">
            该产品的详细教程即将上线
          </p>
          <p className="mt-2 text-sm text-slate-500">
            我们正在整理这篇的逐步实操与避坑清单,敬请期待。
          </p>
          {product?.referral_url && (
            <a
              href={product.referral_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              先去开户 →
            </a>
          )}
        </section>
      </div>
    );
  }

  const isFreeGuide = guide.paidMd === null;

  // —— 服务端判定解锁等级:登录态(cookie)→ 购买记录 → 生效档位 ——
  let tier: Tier = "free";
  if (!isFreeGuide) {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    tier = user ? await fetchGuideTier(supabase, user.id, guide.id) : "free";
  }

  const showSteps = canView(tier, "practical");
  const showPitfalls = canView(tier, "full");

  const stepOffers: UnlockOffer[] = [
    {
      tier: "practical",
      label: "解锁实操清单",
      price_cny: guide.price_practical_cny,
      list_price_cny: guide.list_price_practical_cny,
    },
    {
      tier: "full",
      label: "解锁完整版(实操 + 避坑)",
      price_cny: guide.price_cny,
      list_price_cny: guide.list_price_cny,
    },
  ];
  const pitfallOffers: UnlockOffer[] = [
    {
      tier: "full",
      label:
        tier === "practical"
          ? "升级完整版解锁避坑清单"
          : "解锁完整版(实操 + 避坑)",
      price_cny: guide.price_cny,
      list_price_cny: guide.list_price_cny,
    },
  ];

  return (
    <div className="max-w-2xl py-6 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <Link href="/decider" className="text-sm text-slate-500 transition hover:text-slate-900">
          ← 返回教程库
        </Link>
        <AuthBar />
      </div>

      <header className="mb-6 mt-4">
        <p className="text-xs font-medium text-slate-400">
          {guide.productName} · 实操教程
          {isFreeGuide && (
            <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              全文免费
            </span>
          )}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          {guide.title}
        </h1>
        <p className="mt-2 text-xs text-emerald-600">
          ✓ {formatVerified(guide.verified_at)} · 政策/费率随时会变,以官方最新为准
        </p>
      </header>

      {/* —— 支付回跳提示:webhook 写库可能有几秒延迟 —— */}
      {purchase === "success" && tier === "free" && !isFreeGuide && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          支付已提交,解锁可能有几秒延迟。若下方仍是锁定状态,请稍候{" "}
          <Link href={`/decider/guide/${guide.id}`} className="font-medium underline">
            刷新本页
          </Link>
          。
        </div>
      )}
      {purchase === "success" && tier !== "free" && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          ✅ 解锁成功,感谢支持!内容已在下方展开。
        </div>
      )}

      {/* —— 免费部分:阅读视图,始终完整显示 —— */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <Reader md={guide.freeMd} />
      </section>

      {/* —— 开户 CTA:referral 转化位(免费层,和付费不冲突) —— */}
      {product && (product.referral_url || product.signup_note) && (
        <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          {/* 左列短文案固定宽度,右侧按钮/说明框弹性——否则无直达链接的长说明会把左列挤成一字一行 */}
          <div className="sm:shrink-0">
            <p className="text-sm font-semibold text-slate-900">
              准备好了就去开户
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {product.referral_code
                ? `注册时填邀请码 ${product.referral_code} 可拿新人奖励`
                : "开户免费,几分钟搞定"}
            </p>
          </div>
          {product.referral_url ? (
            <a
              href={product.referral_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg bg-slate-900 px-5 py-2.5 text-center text-sm font-medium text-white transition hover:bg-slate-700"
            >
              免费:去开户 →
            </a>
          ) : (
            <span className="min-w-0 rounded-lg border border-dashed border-amber-300 bg-white px-4 py-2.5 text-left text-xs leading-relaxed text-slate-600 sm:max-w-md">
              {product.signup_note}
            </span>
          )}
        </section>
      )}

      {/* —— 付费板块 1:逐步实操(practical 档) —— */}
      {guide.paidMd && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            逐步实操详情
          </h2>

          {showSteps ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <Reader md={guide.paidMd} />
            </div>
          ) : (
            <LockedCard lines={10}>
              <p className="text-sm font-medium text-slate-700">
                逐步实操详情为付费内容
              </p>
              <UnlockPanel guideId={guide.id} offers={stepOffers} paymentsEnabled={paymentsEnabled} />
            </LockedCard>
          )}
        </section>
      )}

      {/* —— 付费板块 2:避坑清单(full 档) —— */}
      {guide.pitfallsMd && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            避坑清单
          </h2>

          {showPitfalls ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <Reader md={guide.pitfallsMd} />
            </div>
          ) : (
            <LockedCard lines={6}>
              <p className="text-sm font-medium text-slate-700">
                避坑清单为完整版付费内容
              </p>
              <UnlockPanel guideId={guide.id} offers={pitfallOffers} paymentsEnabled={paymentsEnabled} />
            </LockedCard>
          )}
        </section>
      )}

      <div className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-400">
        产品政策(费率/返现/地区)随时会变,以官方最新为准。教程内容为本人实测记录,有问题找{" "}
        <a
          href="https://x.com/zynqorw"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          X @zynqorw
        </a>
        。
      </div>
    </div>
  );
}
