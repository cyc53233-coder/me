"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site";

const TABS = [
  { href: "/", label: "딜" },
  { href: "/about", label: "채널 소개" },
  { href: "/admin", label: "관리" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="top">
      <div className="wrap top-inner">
        <Link className="brand" href="/">
          <span className="brand-emoji">{SITE.emoji}</span>
          <span>{SITE.name}</span>
        </Link>
        <nav className="top-nav">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={
                tab.href === "/" ? (pathname === "/" ? "page" : undefined)
                : pathname.startsWith(tab.href) ? "page"
                : undefined
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
