"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "admin_auth";

/** 登录页表单提交：验证访问码，通过则写 cookie（哈希值，改码即全端失效）并跳回原页 */
export async function login(formData: FormData): Promise<void> {
  const code = process.env.ADMIN_ACCESS_CODE ?? "";
  const input = String(formData.get("code") ?? "");
  const nextRaw = String(formData.get("next") ?? "/");
  // 只允许站内相对路径，防开放重定向
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  const inputHash = createHash("sha256").update(input).digest();
  const codeHash = createHash("sha256").update(code).digest();
  if (!code || !timingSafeEqual(inputHash, codeHash)) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  (await cookies()).set(COOKIE_NAME, inputHash.toString("hex"), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180, // 半年免重登，个人设备可接受
    path: "/",
    // 不设 secure：局域网 http 访问是常态
  });
  redirect(next);
}
