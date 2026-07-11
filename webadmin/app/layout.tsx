import type { Metadata } from "next";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { MODULES } from "@/lib/modules";
import { SITE, siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/rss.xml", title: SITE.name }] },
  },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
    locale: "zh_CN",
  },
  twitter: { card: "summary", creator: "@zynqorw" },
};

/** 公开访客永远可见的导航 */
const PUBLIC_NAV = [
  { label: "文章", href: "/posts" },
  { label: "关于", href: "/about" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 导航按登录态分层：访客只看公开层，登录后追加工作台模块
  const authed = await isAdminAuthed();

  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col bg-neutral-50 text-neutral-800 antialiased">
        <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-neutral-50/90 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 xl:max-w-[1480px]">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight hover:text-neutral-600">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              {SITE.name}
            </Link>
            <div className="flex flex-1 items-center gap-4 text-sm text-neutral-500">
              {PUBLIC_NAV.map((l) => (
                <Link key={l.href} href={l.href} className="transition-colors hover:text-neutral-900">
                  {l.label}
                </Link>
              ))}
              {authed &&
                MODULES.filter((m) => m.status === "active").map((m) =>
                  m.external ? (
                    <a key={m.id} href={m.href} className="transition-colors hover:text-neutral-900">
                      {m.name} ↗
                    </a>
                  ) : (
                    <Link key={m.id} href={m.href} className="transition-colors hover:text-neutral-900">
                      {m.name}
                    </Link>
                  )
                )}
            </div>
            {!authed && (
              <Link
                href="/login"
                className="text-[12px] text-neutral-400 transition-colors hover:text-neutral-700"
              >
                工作台登录
              </Link>
            )}
          </nav>
        </header>
        {/* xl 起加宽给轨道内双侧栏让位；窄屏维持 5xl 单栏 */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 xl:max-w-[1480px]">{children}</main>
        <footer className="border-t border-neutral-200/80">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 text-[12px] text-neutral-400 xl:max-w-[1480px]">
            <span>© {new Date().getFullYear()} {SITE.name} · 实测为本，AI 起草，人工把关</span>
            <a href="/rss.xml" className="transition-colors hover:text-neutral-600">
              RSS
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
