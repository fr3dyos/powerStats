import Link from "next/link";

import { AppShell } from "@/app/_components/AppShell";
import { getServerLocale } from "@/utils/i18n-server";
import { playersApi, teamsApi, teamColor, formatPlayerName } from "@/utils/api";
import { PlayersList } from "./_components/PlayersList";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 500;

export default async function PlayersIndexPage() {
  const { dict } = await getServerLocale();
  const common = dict.common;
  const nav = dict.navigation;
  const pi = dict.playersIndex;

  // Fetch all players + a name-id map for the team labels. We bound the
  // result set; teams that exceed this cap will need pagination (a follow-up).
  const [players, teams] = await Promise.all([
    playersApi.list(undefined, { skip: 0, limit: PAGE_SIZE }).catch(() => []),
    teamsApi.list({ skip: 0, limit: PAGE_SIZE }).catch(() => []),
  ]);

  const teamMap = new Map(
    teams.map((t) => [t.id, t.name] as const),
  );

  return (
    <AppShell
      brandSubtitle={pi.title}
      footerText={common.footer}
      authLinks={[
        { label: nav.rankings, href: "/rankings", variant: "ghost" },
      ]}
    >
      <section className="ps-admin">
        <div className="ps-section">
          <span className="ps-section__eyebrow">{pi.eyebrow}</span>
          <h1>{pi.title}</h1>
          <p>{pi.subtitle}</p>
        </div>

        <PlayersList
          players={players.map((p) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            jersey_number: p.jersey_number ?? null,
            team_id: p.team_id,
            team_name: teamMap.get(p.team_id) ?? null,
          }))}
          labels={{
            searchPlaceholder: pi.searchPlaceholder,
            noPlayers: pi.noPlayers,
            resultCount: pi.resultCount,
            name: common.player,
            jersey: common.jersey,
            team: common.team,
          }}
        />
      </section>
    </AppShell>
  );
}
