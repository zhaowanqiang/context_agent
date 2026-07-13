import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { isAdminAuthed } from "@/lib/adminAuth";
import { MODULES } from "@/lib/modules";
import { SITE, siteUrl } from "@/lib/site";
import NavLinks from "@/components/NavLinks";
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
  twitter: { card: "summary_large_image", creator: "@zynqorw" },
};

/** 公开访客永远可见的导航 */
const PUBLIC_NAV = [
  { label: "文章", href: "/posts" },
  { label: "此刻", href: "/now" },
  { label: "关于", href: "/about" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 布局按登录态分层：访客 = 窄栏编辑部版式（header/正文/页脚同一条 42rem 网格），
  // 登录后 = 宽幅工作台（xl 起 1480px 给轨道双侧栏让位）
  const authed = await isAdminAuthed();
  const container = authed ? "max-w-5xl xl:max-w-[1480px]" : "max-w-2xl";

  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col bg-neutral-50 text-neutral-800 antialiased">
        <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-neutral-50/90 backdrop-blur">
          <nav className={`mx-auto flex ${container} items-center gap-7 px-4 py-3.5`}>
            <Link
              href="/"
              className="font-display flex items-baseline gap-0.5 text-[17px] font-bold tracking-tight hover:text-neutral-600"
            >
              {SITE.name}
              <span className="text-amber-500" aria-hidden>.</span>
            </Link>
            {/* 左组=公开导航；右组=工作台导航（登录后），语义分区不混排 */}
            <div className="flex flex-1 items-center gap-6 text-sm">
              <NavLinks items={PUBLIC_NAV} />
            </div>
            {authed ? (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <NavLinks
                  items={[
                    { label: "工作台", href: "/dashboard" },
                    ...MODULES.filter((m) => m.status === "active").map((m) => ({
                      label: m.name,
                      href: m.href,
                      external: m.external,
                      match: m.id === "contentagent" ? "/agent" : undefined,
                    })),
                  ]}
                />
              </div>
            ) : process.env.PUBLIC_FACADE === "1" ? null : (
              <Link
                href="/login"
                className="text-[12px] text-neutral-400 transition-colors hover:text-neutral-700"
              >
                工作台登录
              </Link>
            )}
          </nav>
        </header>
        <main className={`mx-auto w-full ${container} flex-1 px-4 py-6`}>{children}</main>
        <footer className="mt-16 border-t border-neutral-200/70">
          <div className={`mx-auto ${container} px-4 py-8`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
              <div>
                <span className="font-display text-[15px] font-bold tracking-tight text-neutral-700">
                  {SITE.name}<span className="text-amber-500">.</span>
                </span>
                <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-400">
                  实测为本，AI 起草，人工把关 · © {new Date().getFullYear()}
                </p>
              </div>
              <div className="flex gap-5 text-[13px] text-neutral-500">
                {SITE.links.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="transition-colors hover:text-neutral-900">
                    {l.label}
                  </a>
                ))}
                <a href="/rss.xml" className="transition-colors hover:text-neutral-900">
                  RSS
                </a>
              </div>
            </div>
          </div>
        </footer>
        {/* Vercel Web Analytics：只在 Vercel 部署实例生效，本机是空操作 */}
        <Analytics />
      </body>
    </html>
  );
}
