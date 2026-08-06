import { AppShell } from "@/app/_components/AppShell";
import {
  gamesApi,
  teamsApi,
  tournamentsApi,
} from "@/utils/api";
import { getServerLocale } from "@/utils/i18n-server";

import {
  TournamentBrowser,
  type TournamentStatus,
} from "./TournamentBrowser";

export const revalidate = 60;

export default async function TournamentsListPage() {
  const { dict } = await getServerLocale();
  const common = dict.common;
  const trn = dict.tournament;
  const nav = dict.navigation;

  const tournaments = await tournamentsApi.list(100).catch(() => []);

  // Pre-fetch team counts so each card shows the team count without N+1.
  const teamCounts: Record<number, number> = {};
  await Promise.all(
    tournaments.map(async (t) => {
      try {
        const teams = await teamsApi.listByTournament(t.id);
        teamCounts[t.id] = teams.length;
      } catch {
        teamCounts[t.id] = 0;
      }
    }),
  );

  // Classify each tournament by status. Games API failures are swallowed so
  // the page still renders when the games endpoint is unavailable — those
  // tournaments fall back to date-based status.
  const statuses: Record<number, TournamentStatus> = {};
  const now = Date.now();
  for (const t of tournaments) {
    let hasInProgress = false;
    let gamesUnavailable = false;
    try {
      const games = await gamesApi.listByTournament(t.id);
      hasInProgress = games.some((g) => !g.is_completed);
    } catch {
      gamesUnavailable = true;
    }
    const start = new Date(t.start_date).getTime();
    const end = new Date(t.end_date).getTime();
    if (hasInProgress) {
      statuses[t.id] = "live";
    } else if (end < now) {
      statuses[t.id] = "completed";
    } else if (start > now) {
      statuses[t.id] = "upcoming";
    } else {
      // Tournament window is open. If we couldn't reach the games endpoint we
      // can't prove a game is live, so fall back to "upcoming" rather than
      // mislabeling. Otherwise treat as live.
      statuses[t.id] = gamesUnavailable ? "upcoming" : "live";
    }
  }

  return (
    <AppShell
      brandSubtitle="Ultimate Frisbee tournament manager"
      footerText={common.footer}
      authLinks={[
        { label: nav.rankings, href: "/rankings", variant: "ghost" },
        { label: nav.admin, href: "/admin/login", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <div className="ps-section">
          <span className="ps-section__eyebrow">{trn.browse}</span>
          <h1>{trn.title}</h1>
          <p>{trn.subtitle}</p>
        </div>

        {tournaments.length === 0 ? (
          <div className="ps-card">
            <h3>{common.noTournaments}</h3>
            <p>{trn.noTournamentsCopy}</p>
          </div>
        ) : (
          <TournamentBrowser
            tournaments={tournaments}
            teamCounts={teamCounts}
            statuses={statuses}
            copy={{
              teams: common.teams,
              viewTournament: common.viewTournament,
              searchPlaceholder: trn.searchPlaceholder,
              filterAll: trn.filterAll,
              filterUpcoming: trn.filterUpcoming,
              filterLive: trn.filterLive,
              filterCompleted: trn.filterCompleted,
              statusUpcoming: trn.statusUpcoming,
              statusLive: trn.statusLive,
              statusCompleted: trn.statusCompleted,
              noMatches: trn.noMatches,
            }}
          />
        )}
      </section>
    </AppShell>
  );
}
