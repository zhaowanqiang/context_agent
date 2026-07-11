import type { Metadata } from "next";
import { login } from "@/app/actions/auth";

export const metadata: Metadata = { title: "登录" };

/** 访问码登录页：proxy.ts 拦下未认证请求后跳到这里 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="mx-auto mt-[16vh] w-full max-w-xs">
      <div className="mb-6 flex items-center gap-2 font-bold tracking-tight">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
        zynqorw 工作台
      </div>
      <form action={login} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? "/"} />
        <input
          type="password"
          name="code"
          placeholder="访问码"
          autoFocus
          required
          autoComplete="current-password"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-[15px] outline-none transition-colors focus:border-amber-500"
        />
        {error && <p className="text-[13px] text-red-600">访问码不正确</p>}
        <button
          type="submit"
          className="rounded-md bg-neutral-800 px-3 py-2 text-[14px] font-medium text-white transition-colors hover:bg-neutral-700"
        >
          进入
        </button>
      </form>
      <p className="mt-4 text-[12px] leading-relaxed text-neutral-400">
        访问码配置在 webadmin/.env.local 的 ADMIN_ACCESS_CODE，改码后所有设备需重新登录。
      </p>
    </div>
  );
}
