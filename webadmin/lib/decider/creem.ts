import crypto from "node:crypto";

// Creem(Merchant-of-Record)适配层:把「建 checkout」和「验 webhook 签名」两处平台相关逻辑
// 集中在这里。换平台只改本文件 + data/creem-products.ts,业务代码(路由 / UnlockPanel)不动。
//
// 字段名以 Creem 官方文档为准(https://docs.creem.io)。若上线时接口有出入,改这里即可。

const API_BASE = process.env.CREEM_API_BASE ?? "https://api.creem.io";

// checkout 时塞进去、webhook 里原样取回的身份信息 —— 决定「付款后给谁解锁哪一档」。
export interface CheckoutMetadata {
  user_id: string;
  guide_id: string;
  tier: "practical" | "full";
}

// 建一个 Creem 托管的 checkout 会话,返回可跳转的支付页 URL。
export async function createCheckout(params: {
  productId: string;
  successUrl: string;
  metadata: CheckoutMetadata;
  // 关联 id,便于对账;也作为幂等参考
  requestId?: string;
}): Promise<{ checkoutUrl: string }> {
  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 CREEM_API_KEY,无法创建 checkout");
  }

  const res = await fetch(`${API_BASE}/v1/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      product_id: params.productId,
      success_url: params.successUrl,
      request_id: params.requestId,
      metadata: params.metadata,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Creem 建单失败 (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { checkout_url?: string };
  if (!data.checkout_url) {
    throw new Error("Creem 返回缺少 checkout_url");
  }
  return { checkoutUrl: data.checkout_url };
}

// 校验 webhook 签名:Creem 用 webhook 密钥对「原始请求体」做 HMAC-SHA256(hex),
// 放在 creem-signature 头里。必须用原始 body 字节计算,不能用解析后再序列化的对象。
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[creem] 缺少 CREEM_WEBHOOK_SECRET,拒绝 webhook");
    return false;
  }
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // 定长安全比较,避免时序侧信道。长度不一致时 timingSafeEqual 会抛错,先挡掉。
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// webhook 事件里我们关心的部分。checkout.completed 表示一次性付款成功。
export interface CreemWebhookEvent {
  eventType?: string;
  object?: {
    status?: string;
    metadata?: Partial<CheckoutMetadata>;
  };
}
