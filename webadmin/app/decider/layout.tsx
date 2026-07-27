import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { AuthProvider } from "@/components/decider/AuthProvider";

/**
 * decider（出海开户决策）子树的嵌套 layout。
 *
 * 它原本是独立应用的 root layout，并入主站后：
 * - 去掉 <html>/<body>（嵌套 layout 不能有），页面外壳改用主站 header/footer
 * - 字体挂在包裹 div 上，配合 globals.css 的 .decider-scope 把
 *   --font-display 从主站的 Georgia 换成 IBM Plex，只影响本子树
 * - AuthProvider 保留：decider 有独立的 Supabase 用户账号体系（购买解锁靠它），
 *   与主站的单人访问码（admin_auth cookie）互不相干
 */

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "出海开户决策 · 实测教程库",
  description:
    "海外账户 / U 卡实测教程库（2 篇全文免费），也可以答几个问题，当场拿到适合你的开户推荐顺序与坑点。",
};

export default function DeciderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`decider-scope ${plexSans.variable} ${plexMono.variable}`}>
      <AuthProvider>{children}</AuthProvider>
    </div>
  );
}
