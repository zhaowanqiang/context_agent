import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 服务端(Server Component / Route Handler)用的 Supabase 客户端。
// 浏览器端的 createBrowserClient 默认把 session 存在 cookie 里,
// 所以这里读同一批 cookie 就能拿到登录态,付费判定全部在服务端完成。
export async function createServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "缺少 Supabase 配置:请在 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component 里不允许写 cookie(只有 Server Action / Route Handler 可以)。
          // 静默忽略即可:token 刷新由浏览器端客户端兜底。
        }
      },
    },
  });
}
