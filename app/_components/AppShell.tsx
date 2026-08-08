"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/app/_components/LanguageSwitcher";
import { ThemeToggle } from "@/app/_components/ThemeToggle";

// ---- Global navigation links (shown on every page) ------------------------
const GLOBAL_NAV = [
  { href: "/rankings", label: "Rankings" },
  { href: "/teams", label: "Teams" },
  { href: "/games", label: "Games" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/admin", label: "Admin" },
] as const;

// ---- Public types ---------------------------------------------------------
type AuthLink = {
  label: string;
  href: string;
  variant?: "primary" | "ghost";
};

type Props = {
  children: ReactNode;
  authLinks?: AuthLink[];
  brandSubtitle?: string;
  footerText?: string;
};

// ---- Component ------------------------------------------------------------
export function AppShell({
  children,
  authLinks,
  brandSubtitle,
  footerText,
}: Props) {
  const pathname = usePathname();
  const globalHrefs = new Set<string>(GLOBAL_NAV.map((l) => l.href));

  // Filter out authLinks that duplicate the global nav.
  const filteredAuthLinks = authLinks?.filter(
    (l) => !globalHrefs.has(l.href),
  ) ?? [];

  return (
    <div className="ps-app">
      <header className="ps-header" role="banner">
        <Link href="/" className="ps-header__brand" aria-label="PowerStats home">
          <span aria-hidden="true" className="badge" style={badgeStyle}>
            PS
          </span>
          <span className="ps-header__wordmark">
            <strong>PowerStats</strong>
            {brandSubtitle && <span>{brandSubtitle}</span>}
          </span>
        </Link>

        <nav className="ps-header__nav" aria-label="Primary">
          {GLOBAL_NAV.map((link) => {
            const isActive =
              pathname === link.href ||
              pathname.startsWith(link.href + "/") ||
              (link.href === "/admin" && pathname.startsWith("/admin"));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`ps-nav-link${isActive ? " ps-nav-link--active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}

          {filteredAuthLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                link.variant === "primary"
                  ? "ps-btn ps-btn--primary"
                  : "ps-btn"
              }
            >
              {link.label}
            </Link>
          ))}

          <span className="ps-header__divider" aria-hidden="true" />
          <ThemeToggle />
          <LanguageSwitcher />
        </nav>
      </header>

      <main className="ps-main">{children}</main>

      <footer className="ps-footer">
        <span>
          © {new Date().getFullYear()} PowerStats —{" "}
          {footerText ?? "built for Ultimate."}
        </span>
      </footer>
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #FF5722 0%, #FF8B3D 100%)",
  color: "#FFFFFF",
  fontWeight: 800,
  fontFamily: "Montserrat, Inter, sans-serif",
  fontSize: 14,
  letterSpacing: "-0.02em",
  boxShadow: "0 8px 18px rgba(255, 87, 34, 0.4)",
};
