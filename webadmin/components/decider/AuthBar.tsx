"use client";

import { useState } from "react";
import { useAuth } from "@/components/decider/AuthProvider";
import AuthForm from "@/components/decider/AuthForm";

export default function AuthBar() {
  const { user, loading, supabase } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {loading ? (
        <span className="text-xs text-slate-400">…</span>
      ) : user ? (
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm text-slate-600" title={user.email}>
            {user.email}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
          >
            {signingOut ? "登出中…" : "登出"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          登录 / 注册
        </button>
      )}

      {open && !user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                登录 / 注册
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭"
                className="rounded-md px-2 text-lg leading-none text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>
            <AuthForm onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
