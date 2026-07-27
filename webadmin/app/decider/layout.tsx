import type { Metadata } from "next";
import { AuthProvider } from "@/components/decider/AuthProvider";

/**
 * decider（出海开户决策）子树的嵌套 layout。
 *
 * 它原本是独立应用的 root layout，并入主站后：
 * - 去掉 <html>/<body>（嵌套 layout 不能有），页面外壳改用主站 header/footer
 * - 去掉 next/font（原引 IBM Plex）：主站的既定原则是不引外部 webfont
 *   ——本地优先 + 大陆网络，且构建期不该依赖外网。字体改由 globals.css 的
 *   .decider-scope 用系统字体栈接管，保住 decider 原本的无衬线观感
 *   （主站 --font-display 是 Georgia 衬线，直接继承会把它变个样）
 * - AuthProvider 保留：decider 有独立的 Supabase 用户账号体系（购买解锁靠它），
 *   与主站的单人访问码（admin_auth cookie）互不相干
 */

export const metadata: Metadata = {
  title: "出海开户决策 · 实测教程库",
  description:
    "海外账户 / U 卡实测教程库（2 篇全文免费），也可以答几个问题，当场拿到适合你的开户推荐顺序与坑点。",
};

export default function DeciderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="decider-scope">
      <AuthProvider>{children}</AuthProvider>
    </div>
  );
}
