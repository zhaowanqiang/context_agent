import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "contentagent 后台",
  description: "双轨内容生产：X 干货帖 + 公众号长文",
};

const NAV = [
  { href: "/", label: "仪表盘" },
  { href: "/topics", label: "选题池" },
  { href: "/runs", label: "Runs" },
  { href: "/sources", label: "RSS 源" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <header className="border-b border-neutral-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <span className="font-bold">contentagent</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm text-neutral-600 hover:text-neutral-900">
                {n.label}
              </Link>
            ))}
            <Link
              href="/runs/new"
              className="ml-auto rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
            >
              + 新建 Run
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
