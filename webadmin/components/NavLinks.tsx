"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

/** 顶部导航链接：当前区域高亮（服务端 layout 拿不到路由，活跃态在客户端算） */
export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((l) => {
        if (l.external) {
          return (
            <a key={l.href} href={l.href} className="text-neutral-500 transition-colors hover:text-neutral-900">
              {l.label} ↗
            </a>
          );
        }
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              active
                ? "font-medium text-neutral-900 underline decoration-amber-500 decoration-2 underline-offset-8"
                : "text-neutral-500 transition-colors hover:text-neutral-900"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
