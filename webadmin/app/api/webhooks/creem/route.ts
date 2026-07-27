import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/decider/supabase-admin";
import {
  verifyWebhookSignature,
  type CreemWebhookEvent,
} from "@/lib/decider/creem";
import { getGuide } from "@/data/decider/guides";

// 需要 Node 运行时:要读原始 body 算 HMAC + 用 service_role 写库
export const runtime = "nodejs";

// Creem 付款成功后回调这里。流程:验签 → 取 metadata → service_role 写 purchases。
// 写库用 upsert 忽略重复,保证 webhook 重试 / 多次投递时幂等,不会报错也不会重复解锁。
export async function POST(req: Request) {
  // 1) 必须用原始字节验签,所以先取 text(不能先 .json() 再序列化,字节会变)
  const rawBody = await req.text();
  const signature = req.headers.get("creem-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[creem webhook] 签名校验失败,拒绝");
    return NextResponse.json({ error: "签名无效" }, { status: 400 });
  }

  // 2) 解析事件
  let event: CreemWebhookEvent;
  try {
    event = JSON.parse(rawBody) as CreemWebhookEvent;
  } catch {
    return NextResponse.json({ error: "body 不是合法 JSON" }, { status: 400 });
  }

  // 只处理一次性付款完成事件;其它事件直接 200 忽略(避免 Creem 反复重试)
  if (event.eventType !== "checkout.completed") {
    return NextResponse.json({ received: true });
  }

  // 3) 取回建单时塞进去的身份信息
  const meta = event.object?.metadata;
  const userId = meta?.user_id;
  const guideId = meta?.guide_id;
  const tier = meta?.tier;

  if (!userId || !guideId || (tier !== "practical" && tier !== "full")) {
    console.error("[creem webhook] metadata 缺失或非法:", meta);
    // 200:数据问题重试也没用,只记日志人工排查,别让 Creem 一直重投
    return NextResponse.json({ received: true });
  }
  if (!getGuide(guideId)) {
    console.error("[creem webhook] 未知 guide_id:", guideId);
    return NextResponse.json({ received: true });
  }

  // 4) service_role 写库,幂等:同一 (user_id, guide_id, tier) 已存在就跳过
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("purchases")
    .upsert(
      { user_id: userId, guide_id: guideId, tier },
      { onConflict: "user_id,guide_id,tier", ignoreDuplicates: true }
    );

  if (error) {
    // 写库失败返回 500,让 Creem 稍后重试(此时幂等保证不会重复解锁)
    console.error("[creem webhook] 写 purchases 失败:", error.message);
    return NextResponse.json({ error: "写库失败" }, { status: 500 });
  }

  console.info(
    `[creem webhook] 解锁成功 user=${userId} guide=${guideId} tier=${tier}`
  );
  return NextResponse.json({ received: true });
}
