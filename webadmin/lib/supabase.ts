import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/** 服务端专用 Supabase 客户端（service_role，绕过 RLS）。浏览器永不直连。 */
export function db(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY —— 复制 webadmin/.env.local.example 为 .env.local 并填入 Supabase 项目凭据。"
      );
    }
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}
