"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/decider/AuthProvider";

type Mode = "login" | "signup";

export default function AuthForm({ onClose }: { onClose?: () => void }) {
  const { supabase } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (!data.session) {
        // 开启了邮箱确认:还没拿到 session,需要用户去邮箱点确认链接
        setMessage("注册成功!请到邮箱点开确认链接后再登录。");
      } else {
        // 未开启邮箱确认:直接登录成功
        onClose?.();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        onClose?.();
      }
    }

    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
            setMessage(null);
          }}
          className={[
            "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
            mode === "login"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          ].join(" ")}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
            setMessage(null);
          }}
          className={[
            "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
            mode === "signup"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          ].join(" ")}
        >
          注册
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">邮箱</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">密码</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
          placeholder="至少 6 位"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {busy ? "处理中…" : mode === "login" ? "登录" : "注册"}
      </button>
    </form>
  );
}
