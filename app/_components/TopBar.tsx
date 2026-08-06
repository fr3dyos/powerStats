// Server-rendered top bar. Owns auth-aware links, the user pill, and the
// sign-out button. Kept as a separate component so `app/layout.tsx` stays
// focused on the HTML shell.

import Link from "next/link";
import { cookies } from "next/headers";

import { getAuthedUser } from "@/utils/supabase/server";
import { SignOutButton } from "./SignOutButton";

type NavLink = { href: string; label: string };

export async function TopBar({
  links,
  signOutLabel = "Logout",
}: {
  links: NavLink[];
  signOutLabel?: string;
}) {
  const cookieStore = await cookies();
  const { user } = await getAuthedUser(cookieStore);

  return (
    <header className="ps-topbar" role="banner">
      <div className="ps-topbar__inner">
        <Link href="/" className="ps-topbar__brand" aria-label="PowerStats home">
          <span className="ps-disc ps-disc--sm" aria-hidden="true" />
          <span className="ps-topbar__title">PowerStats</span>
        </Link>

        <nav className="ps-topbar__nav" aria-label="Primary">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="ps-topbar__link">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ps-topbar__user">
          {user ? (
            <>
              <span className="ps-topbar__username" title={user.email ?? undefined}>
                {user.email ?? user.user_metadata?.user_name ?? "Account"}
              </span>
              <SignOutButton label={signOutLabel} />
            </>
          ) : (
            <Link href="/admin/login" className="ps-btn ps-btn--primary">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
