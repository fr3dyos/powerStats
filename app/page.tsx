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
  const dict = getDictionary(pickLocale(undefined));
  const params = (await Promise.resolve(searchParams)) ?? {};
  const errorParam = Array.isArray(params.error) ? params.error[0] : params.error;
  const unauthorized = errorParam === "unauthorized";

  return (
    <AppShell
      brandSubtitle="Ultimate Frisbee tournament manager"
      authLinks={[
        { label: "Browse tournaments", href: "/tournaments", variant: "ghost" },
        { label: "Rankings", href: "/rankings", variant: "ghost" },
        { label: dict.auth.enterAsAdmin, href: "/admin/login", variant: "primary" },
      ]}
    >
      <section className="ps-hero">
        <div className="ps-hero__inner">
          <span className="ps-hero__pill">
            <span className="dot" aria-hidden="true" />
            Welcome to PowerStats
          </span>
          <h1>Run the tournament.<br />Score every point.</h1>
          <p className="lead">
            PowerStats is the live scoring, bracket, and stats console for
            Ultimate Frisbee tournaments. Built for directors who need
            accurate data when the disc is in the air.
          </p>

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
            <Link className="ps-btn ps-btn--primary" href="/tournaments">
              Browse tournaments
            </Link>
            <Link className="ps-btn" href="/rankings">
              View rankings
            </Link>
            <Link className="ps-btn ps-btn--ghost" href="/admin/login">
              {dict.auth.enterAsAdmin}
            </Link>
          </div>

          <p
            style={{
              marginTop: 32,
              color: "var(--ps-text-muted)",
              fontSize: 13,
            }}
          >
            Tournament director?{" "}
            <Link href="/admin/login">{dict.auth.enterAsAdmin}</Link> to manage
            events.
          </p>
        </div>
      </section>

      <section
        id="features"
        className="ps-admin"
        style={{ paddingTop: 0, paddingBottom: 80 }}
      >
        <div className="ps-section" style={{ alignItems: "center", textAlign: "center" }}>
          <span className="ps-section__eyebrow">Everything you need</span>
          <h2>From pull to playoff</h2>
          <p>
            One console for live scoring, brackets, round-robin scheduling,
            and player analytics. Wire it to a single field or a 64-team
            championship.
          </p>
        </div>

        <div className="ps-grid">
          <article className="ps-card ps-card--linked">
            <span className="ps-card__icon" aria-hidden="true">
              01
            </span>
            <h3>Live scoring</h3>
            <p>
              Real-time updates for goals, assists, defenses, timeouts, and
              halves — directly from the field.
            </p>
            <Link
              href="/tournaments"
              className="ps-card__footer"
              style={{ color: "var(--ps-primary-container)" }}
            >
              Browse tournaments →
            </Link>
          </article>
          <article className="ps-card ps-card--linked">
            <span className="ps-card__icon" aria-hidden="true">
              02
            </span>
            <h3>Tournament formats</h3>
            <p>
              Flexible support for round-robin pools, single-elimination
              brackets, and multi-phase playoffs.
            </p>
            <Link
              href="/tournaments"
              className="ps-card__footer"
              style={{ color: "var(--ps-primary-container)" }}
            >
              See fixtures →
            </Link>
          </article>
          <article className="ps-card ps-card--linked">
            <span className="ps-card__icon" aria-hidden="true">
              03
            </span>
            <h3>Performance insights</h3>
            <p>
              Deep dive into team trends, statistical leaders, and
              cross-tournament player history.
            </p>
            <Link
              href="/rankings"
              className="ps-card__footer"
              style={{ color: "var(--ps-primary-container)" }}
            >
              View rankings →
            </Link>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
