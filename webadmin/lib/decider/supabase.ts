import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 浏览器端 Supabase 客户端（decider 的用户账号 / 登录态）。
 *
 * ⚠️ 这里绝不能在模块顶层 throw。
 * 原实现是模块加载即校验并抛错，而 AuthProvider 在 render 期就调用本函数——
 * /decider 在 PUBLIC_FACADE 模式下会被静态预渲染（isAdminAuthed 不读 cookie，
 * 页面因此可以静态化），于是构建期就走到那行，把整个生产构建打挂：
 *   Error occurred prerendering page "/decider" … at module evaluation
 * 一个子功能的环境变量缺失，不该让整站构建失败。
 *
 * 现改为：配置缺失时返回 null，由 AuthProvider 降级——登录相关 UI 不可用，
 * 但教程库与免费正文照常渲染——并留一条明确日志。
 */
export function createClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[decider] 缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY —— 登录与解锁功能不可用"
    );
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
