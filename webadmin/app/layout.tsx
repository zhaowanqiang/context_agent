import type { Metadata } from "next";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { MODULES } from "@/lib/modules";
import { SITE, siteUrl, TG_GROUP_URL, X_URL } from "@/lib/site";
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

/** 公开访客永远可见的导航。/deals（我在用的）不进主导航，入口在页脚 */
const PUBLIC_NAV = [
  { label: "X 文章", href: "/on-x" },
  { label: "加密卡片", href: "/cards" },
  { label: "海外手机号", href: "/numbers" },
  // decider 是站内公开路由（不是外链，不加 external），排在「关于」前：
  // 访客从任何一页都能回到产品，此前只有首页卡片一个入口
  { label: "开户决策", href: "/decider" },
  { label: "关于", href: "/about" },
];

/** 页脚外链：两个阵地 + GitHub */
const FOOTER_LINKS = [
  { label: "X @zynqorw", href: X_URL },
  { label: "TG 交流群", href: TG_GROUP_URL },
  { label: "GitHub", href: "https://github.com/zhaowanqiang" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 布局按登录态分层：访客 = 窄栏编辑部版式（header/正文/页脚同一条 42rem 网格），
  // 登录后 = 宽幅工作台（xl 起 1480px 给轨道双侧栏让位）
  const authed = await isAdminAuthed();
  // 访客站从「42rem 编辑部窄栏」放宽到 64rem 常规网站宽度——两侧不再大片留白；
  // 宽导航 + 页内长文各自居中收窄(prose 页保留 max-w-2xl)是标准网站版式
  const container = authed ? "max-w-5xl xl:max-w-[1480px]" : "max-w-5xl";

  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col bg-neutral-50 text-neutral-800 antialiased">
        <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-neutral-50/90 backdrop-blur">
          {/* 窄屏允许换行：链接 + 入群按钮在手机上一行放不下，body 的 overflow-x: clip 会直接裁掉 */}
          <nav className={`mx-auto flex ${container} flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3.5`}>
            <Link
              href="/"
              className="font-display flex items-baseline gap-0.5 text-[17px] font-bold tracking-tight hover:text-neutral-600"
            >
              {SITE.name}
              <span className="text-amber-500" aria-hidden>.</span>
            </Link>
            {/* 左组=公开导航；右组=工作台导航（登录后），语义分区不混排 */}
            {/* 手机上链接组单独占满一行排在最后（logo 与登录入口留在第一行），sm 起回到行内 */}
            <div className="order-last flex basis-full flex-wrap items-center gap-x-5 gap-y-1.5 text-sm sm:order-none sm:flex-1 sm:basis-auto sm:gap-x-6">
              <NavLinks items={PUBLIC_NAV} />
              <a
                href={TG_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-amber-700 px-3 py-1 text-[13px] font-medium text-white transition hover:bg-amber-800"
              >
                加入交流群 ↗
              </a>
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
                className="ml-auto text-[12px] text-neutral-500 transition-colors hover:text-neutral-800"
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
                <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">
                  跨境金融 · 加密卡 · 海外手机号实测 · © {new Date().getFullYear()}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-neutral-500">
                <Link href="/deals" className="transition-colors hover:text-neutral-900">
                  我在用的
                </Link>
                {FOOTER_LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-neutral-900"
                  >
                    {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
