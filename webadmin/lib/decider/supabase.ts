import { createBrowserClient } from "@supabase/ssr";

// 从 .env.local 读取配置(NEXT_PUBLIC_ 前缀的变量会暴露给浏览器端)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // 占位值为空时给出清晰报错,而不是后面莫名其妙地失败
  throw new Error(
    "缺少 Supabase 配置:请在 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

// 浏览器端 Supabase 客户端(第 2 步只用来做登录/注册)
export function createClient() {
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
