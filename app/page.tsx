import Link from "next/link";

import { AppShell } from "@/app/_components/AppShell";
import { getDictionary, pickLocale } from "@/utils/i18n";

type SearchParams = {
  error?: string | string[];
};

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  // Server Component — resolve locale + dictionary in one place.
  // i18n is not cookie/header-aware yet, so we default to English and let
  // future enhancements (next-intl, Accept-Language) drive locale selection.
  const dict = getDictionary(pickLocale(undefined));

  const params = (await Promise.resolve(searchParams)) ?? {};
  const errorParam = Array.isArray(params.error) ? params.error[0] : params.error;
  const unauthorized = errorParam === "unauthorized";

  return (
    <AppShell
      brandSubtitle={dict.adminDashboard.subtitle ?? "Ultimate Frisbee tournament manager"}
      authLinks={[
        { label: dict.auth.enterAsAdmin, href: "/admin/login", variant: "primary" },
      ]}
    >
      <section className="ps-hero">
        <div className="ps-hero__inner">
          <span className="ps-hero__pill">
            <span className="dot" aria-hidden="true" />
            Welcome to PowerStats
          </span>
          <h1>{dict.adminDashboard.welcome}</h1>
          <p className="lead">{dict.adminDashboard.subtitle}</p>

          {unauthorized ? (
            <div
              role="alert"
              aria-live="polite"
              className="ps-status ps-status--error"
              style={{ maxWidth: 520, margin: "0 auto 20px" }}
            >
              {dict.auth.unauthorized}
            </div>
          ) : null}

          <div className="ps-hero__cta">
            <Link className="ps-btn ps-btn--primary" href="/admin/login">
              {dict.auth.enterAsAdmin}
            </Link>
            <Link className="ps-btn" href="#features">
              Learn about PowerStats
            </Link>
          </div>

          <p
            style={{
              marginTop: 24,
              color: "var(--ps-text-muted)",
              fontSize: 13,
            }}
          >
            Are you an organizer?{" "}
            <Link href="/admin/login">{dict.auth.enterAsAdmin}</Link> to create
            and manage your event.
          </p>
        </div>
      </section>

      <section
        id="features"
        className="ps-admin"
        style={{ paddingTop: 0, paddingBottom: 80 }}
      >
        <h2
          style={{
            textAlign: "center",
            marginBottom: 24,
            color: "var(--ps-text)",
          }}
        >
          Everything you need to run the tournament.
        </h2>
        <div className="ps-grid">
          <article className="ps-card">
            <span className="ps-card__icon" aria-hidden="true">
              01
            </span>
            <h3>Live scoring</h3>
            <p>
              Real-time updates for goals, assists, turns, and blocks directly
              from the field.
            </p>
            <span className="ps-card__footer">{dict.adminDashboard.liveScoring}</span>
          </article>
          <article className="ps-card">
            <span className="ps-card__icon" aria-hidden="true">
              02
            </span>
            <h3>Tournament formats</h3>
            <p>
              Flexible support for round-robin pools, complex bracket
              progression, and Swiss systems.
            </p>
            <span className="ps-card__footer">{dict.adminDashboard.tournaments}</span>
          </article>
          <article className="ps-card">
            <span className="ps-card__icon" aria-hidden="true">
              03
            </span>
            <h3>Performance insights</h3>
            <p>
              Deep dive into team trends, statistical leaders, and historical
              performance data.
            </p>
            <span className="ps-card__footer">{dict.adminDashboard.players}</span>
          </article>
        </div>
      </section>
    </AppShell>
  );
}