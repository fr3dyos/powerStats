import Link from "next/link";

import { AppShell } from "@/app/_components/AppShell";
import { getServerLocale } from "@/utils/i18n-server";

type SearchParams = {
  error?: string | string[];
};

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const { dict } = await getServerLocale();
  const params = (await Promise.resolve(searchParams)) ?? {};
  const errorParam = Array.isArray(params.error) ? params.error[0] : params.error;
  const unauthorized = errorParam === "unauthorized";

  const home = dict.home;
  const nav = dict.navigation;

  return (
    <AppShell
      brandSubtitle="Ultimate Frisbee tournament manager"
      footerText={dict.common.footer}
      authLinks={[
        { label: nav.tournaments, href: "/tournaments", variant: "ghost" },
        { label: nav.rankings, href: "/rankings", variant: "ghost" },
        { label: dict.auth.enterAsAdmin, href: "/admin/login", variant: "primary" },
      ]}
    >
      <section className="ps-hero">
        <div className="ps-hero__inner">
          <span className="ps-hero__pill">
            <span className="dot" aria-hidden="true" />
            {home.welcome}
          </span>
          <h1>{home.tagline}</h1>
          <p className="lead">{home.lead}</p>

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
              {home.browseTournaments}
            </Link>
            <Link className="ps-btn" href="/rankings">
              {home.viewRankings}
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
            {home.directorCta}{" "}
            <Link href="/admin/login">{dict.auth.enterAsAdmin}</Link>.
          </p>
        </div>
      </section>

      <section
        id="features"
        className="ps-admin"
        style={{ paddingTop: 0, paddingBottom: 80 }}
      >
        <div className="ps-section" style={{ alignItems: "center", textAlign: "center" }}>
          <span className="ps-section__eyebrow">{home.everythingYouNeed}</span>
          <h2>{home.fromPullToPlayoff}</h2>
          <p>{home.featuresLead}</p>
        </div>

        <div className="ps-grid">
          <article className="ps-card ps-card--linked">
            <span className="ps-card__icon" aria-hidden="true">
              01
            </span>
            <h3>{home.liveScoring}</h3>
            <p>{home.liveScoringCopy}</p>
            <Link
              href="/tournaments"
              className="ps-card__footer"
              style={{ color: "var(--ps-primary-container)" }}
            >
              {home.browseTournamentsFooter}
            </Link>
          </article>
          <article className="ps-card ps-card--linked">
            <span className="ps-card__icon" aria-hidden="true">
              02
            </span>
            <h3>{home.tournamentFormats}</h3>
            <p>{home.tournamentFormatsCopy}</p>
            <Link
              href="/tournaments"
              className="ps-card__footer"
              style={{ color: "var(--ps-primary-container)" }}
            >
              {home.seeFixtures}
            </Link>
          </article>
          <article className="ps-card ps-card--linked">
            <span className="ps-card__icon" aria-hidden="true">
              03
            </span>
            <h3>{home.performanceInsights}</h3>
            <p>{home.performanceInsightsCopy}</p>
            <Link
              href="/rankings"
              className="ps-card__footer"
              style={{ color: "var(--ps-primary-container)" }}
            >
              {home.viewRankingsFooter}
            </Link>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
