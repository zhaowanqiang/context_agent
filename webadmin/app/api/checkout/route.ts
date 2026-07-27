import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/decider/supabase-server";
import { createCheckout } from "@/lib/decider/creem";
import { getCreemProductId } from "@/data/decider/creem-products";
import { getGuide } from "@/data/decider/guides";

// 需要 Node 运行时(fetch 到 Creem + 读 cookie 判登录)
export const runtime = "nodejs";

// 已登录用户点「购买」→ 建 Creem checkout → 返回支付页 URL,前端跳转过去。
// 身份 {user_id, guide_id, tier} 作为 metadata 一起带上,webhook 靠它反查该给谁解锁。
export async function POST(req: Request) {
  // 0) 支付通道未接入(缺 CREEM_API_KEY)时明确回绝：createCheckout 反正会抛，
  //    但那条路径返回的是「建单失败,请稍后再试」，会让用户以为是临时故障反复重试。
  //    503 + 明确文案，前端也能据此提示去独立站购买。
  if (!process.env.CREEM_API_KEY) {
    console.error("[checkout] 未配置 CREEM_API_KEY，支付通道未接入");
    return NextResponse.json(
      { error: "本站支付通道尚未开通，请前往 decider.zynqorw.com 购买" },
      { status: 503 }
    );
  }

  // 1) 必须登录:未登录不给建单(否则 webhook 回来不知道解锁给谁)
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  // 2) 校验入参
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const { guideId, tier } = (body ?? {}) as {
    guideId?: string;
    tier?: string;
  };
  if (tier !== "practical" && tier !== "full") {
    return NextResponse.json({ error: "档位非法" }, { status: 400 });
  }
  if (!guideId || !getGuide(guideId)) {
    return NextResponse.json({ error: "教程不存在" }, { status: 400 });
  }

  // 3) 找到该「教程 + 档位」对应的 Creem 商品
  const productId = getCreemProductId(guideId, tier);
  if (!productId) {
    console.error(`[checkout] 未配置 Creem product: ${guideId}:${tier}`);
    return NextResponse.json(
      { error: "该商品尚未配置,请稍后再试" },
      { status: 500 }
    );
  }

  // 4) 建单。成功后 Creem 会把用户跳回 successUrl,并异步回调 webhook 写库。
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  try {
    const { checkoutUrl } = await createCheckout({
      productId,
      successUrl: `${siteUrl}/decider/guide/${guideId}?purchase=success`,
      metadata: { user_id: user.id, guide_id: guideId, tier },
      requestId: `${user.id}:${guideId}:${tier}`,
    });
    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error("[checkout] 建单失败:", err);
    return NextResponse.json({ error: "建单失败,请稍后再试" }, { status: 502 });
  }
}
