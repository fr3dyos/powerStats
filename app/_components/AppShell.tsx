import Link from "next/link";
import type { ReactNode } from "react";

type AuthLink = {
  label: string;
  href: string;
  variant?: "primary" | "ghost";
};

type Props = {
  children: ReactNode;
  authLinks?: AuthLink[];
  brandSubtitle?: string;
};

export function AppShell({ children, authLinks, brandSubtitle }: Props) {
  return (
    <div className="ps-app">
      <header className="ps-header" role="banner">
        <Link href="/" className="ps-header__brand" aria-label="PowerStats home">
          <span aria-hidden="true" className="badge" style={badgeStyle}>
            PS
          </span>
          <span className="ps-header__wordmark">
            <strong>PowerStats</strong>
            <span>{brandSubtitle ?? "Ultimate Frisbee tournament manager"}</span>
          </span>
        </Link>
        <nav className="ps-header__nav" aria-label="Primary">
          {authLinks?.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                link.variant === "primary" ? "ps-btn ps-btn--primary" : "ps-btn"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="ps-main">{children}</main>
      <footer className="ps-footer">
        <span>© {new Date().getFullYear()} PowerStats — built for Ultimate.</span>
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
  background: "linear-gradient(135deg, #FF6B35 0%, #FF8B3D 100%)",
  color: "#0B1220",
  fontWeight: 800,
  fontFamily: "Manrope, Inter, sans-serif",
  fontSize: 14,
  letterSpacing: "-0.02em",
  boxShadow: "0 8px 18px rgba(255, 107, 53, 0.28)",
};
