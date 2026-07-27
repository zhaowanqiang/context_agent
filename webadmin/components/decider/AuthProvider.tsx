"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/decider/supabase";

interface AuthContextValue {
  /** 配置缺失时为 null——消费方需降级，不要断言非空 */
  supabase: SupabaseClient | null;
  user: User | null;
  // 首次拉取 session 期间为 true,避免闪烁"未登录"
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // 只创建一个浏览器端 Supabase 客户端实例
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  // 未配置 Supabase 时无 session 可拉，loading 直接从 false 起步——
  // 不在 effect 里同步 setState（会触发级联渲染，react-hooks 规则也禁止）
  const [loading, setLoading] = useState(supabase !== null);
  const router = useRouter();

  useEffect(() => {
    // 未配置 Supabase：无外部系统可订阅，直接跳过（loading 初始已是 false）
    if (!supabase) return;
    let mounted = true;

    // 刷新后从已存的 session 恢复登录状态
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 登录/登出/token 刷新时实时更新
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      // 登录/登出后让服务端组件重新渲染,教程页的解锁状态在服务端判定,
      // 不刷新的话付费墙会停留在旧状态
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, router]);

  return (
    <AuthContext.Provider value={{ supabase, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 <AuthProvider> 内部使用");
  return ctx;
}
