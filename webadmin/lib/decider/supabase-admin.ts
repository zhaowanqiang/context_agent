import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// service_role 客户端:拥有绕过 RLS 的写权限,只能在服务端(webhook / Route Handler)使用。
// ⚠️ 绝不能在浏览器端引用本文件,SUPABASE_SERVICE_ROLE_KEY 一旦泄露等于数据库门户大开。
//
// 用途:MoR(Creem)webhook 校验签名后,用它把购买记录写进 purchases 表。
// 普通用户的 anon key 受 RLS 限制无法写入,只有这里能写。
// ⚠️ 变量名带 DECIDER_ 前缀，不能用主站的 SUPABASE_SERVICE_ROLE_KEY：
// decider 与主站用的是两个不同的 Supabase 项目（decider 存 purchases/用户账号，
// 主站存 posts/runs）。并入同一个部署后两者共享一份 process.env，同名会互相覆盖——
// 覆盖的后果是 webhook 拿着另一个项目的 key 去写 purchases，
// 用户付了钱却解锁不了，且只在服务端日志里留一行错误。
export function createAdminSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.DECIDER_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "缺少 service_role 配置：请在 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL 和 DECIDER_SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // 服务端一次性调用,不需要持久化/自动刷新 session
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
