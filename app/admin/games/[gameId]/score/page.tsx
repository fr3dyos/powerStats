import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/app/_components/AppShell";
import { getServerLocale } from "@/utils/i18n-server";
import { getAuthedUser } from "@/utils/supabase/server";
import {
  formatDate,
  gamesApi,
  playersApi,
  teamsApi,
  teamColor,
  tournamentsApi,
} from "@/utils/api";

import { LiveScoringConsole } from "./_components/LiveScoringConsole";
import SpiritEntryPanel from "./_components/SpiritEntryPanel";

export const dynamic = "force-dynamic";

type Params = { gameId: string };

export default async function LiveScoringPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const cookieStore = await cookies();
  const { user, role } = await getAuthedUser(cookieStore);
  if (!user) {
    redirect("/admin/login");
  }
  if (role !== "admin" && role !== "scorekeeper") {
    redirect("/?error=unauthorized");
  }

  const { gameId: raw } = await params;
  const gameId = Number(raw);
  if (!Number.isFinite(gameId)) notFound();

  const game = await gamesApi.get(gameId).catch(() => null);
  if (!game) notFound();

  const [tournament, homeTeam, awayTeam, homePlayers, awayPlayers, events] =
    await Promise.all([
      tournamentsApi.get(game.tournament_id).catch(() => null),
      teamsApi.get(game.home_team_id).catch(() => null),
      teamsApi.get(game.away_team_id).catch(() => null),
      playersApi.listByTeam(game.home_team_id).catch(() => []),
      playersApi.listByTeam(game.away_team_id).catch(() => []),
      gamesApi.events(gameId).catch(() => []),
    ]);

  if (!homeTeam || !awayTeam) notFound();
  const canEdit = role === "admin" || role === "scorekeeper";
  const accentHome = teamColor(homeTeam.name);
  const accentAway = teamColor(awayTeam.name);

  const { dict } = await getServerLocale();
  const sc = dict.scoreConsole;

  return (
    <AppShell
      brandSubtitle={sc.brandSubtitle
        .replace("{home}", homeTeam.name)
        .replace("{away}", awayTeam.name)}
      authLinks={[
        {
          label: sc.backToTournamentHub,
          href: tournament ? `/tournaments/${tournament.id}` : "/tournaments",
          variant: "ghost",
        },
        {
          label: sc.bracket,
          href: tournament
            ? `/tournaments/${tournament.id}/bracket`
            : "/tournaments",
          variant: "ghost",
        },
      ]}
    >
      <section className="ps-admin">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              className="ps-disc ps-disc--lg"
              style={{
                background: accentHome ?? undefined,
                color: "#fff",
                borderColor: accentHome ?? undefined,
              }}
            >
              {homeTeam.name.slice(0, 2).toUpperCase()}
            </span>
            <span
              style={{
                fontFamily: "Montserrat, Inter, sans-serif",
                fontWeight: 800,
                fontSize: 28,
              }}
            >
              {sc.vs}
            </span>
            <span
              className="ps-disc ps-disc--lg"
              style={{
                background: accentAway ?? undefined,
                color: "#fff",
                borderColor: accentAway ?? undefined,
              }}
            >
              {awayTeam.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <span className="ps-section__eyebrow">
              {tournament?.name ?? sc.tournamentFallback} · {sc.gameId.replace("{id}", String(game.id))}
            </span>
            <h1 style={{ marginTop: 4 }}>
              {homeTeam.name} {sc.vs} {awayTeam.name}
            </h1>
            <p style={{ color: "var(--ps-text-muted)", marginTop: 4 }}>
              {formatDate(game.start_time)}
              {game.field_number ? ` · ${sc.fieldLabel.replace("{number}", String(game.field_number))}` : ""}
              {!canEdit ? ` · ${sc.readOnlyBanner}` : null}
            </p>
          </div>
        </div>

        <LiveScoringConsole
          initialGame={game}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          initialEvents={events}
          canEdit={canEdit}
          labels={{
            undoLastEvent: sc.undoLastEvent,
            endTimeout: sc.endTimeout,
            advanceHalf: sc.advanceHalf,
            endGame: sc.endGame,
            endGameScoreCap: sc.endGameScoreCap,
            voidGame: sc.voidGame,
            voidGameConfirm: sc.voidGameConfirm,
            markForfeit: sc.markForfeit,
            selectWinningTeam: sc.selectWinningTeam,
            dangerZone: sc.dangerZone,
          }}
        />

        <SpiritEntryPanel
          gameId={game.id}
          homeName={homeTeam.name}
          awayName={awayTeam.name}
          initialHome={game.spirit_home ?? null}
          initialAway={game.spirit_away ?? null}
          canEdit={canEdit}
        />

        <div style={{ marginTop: 24 }}>
          <Link
            href={
              tournament ? `/tournaments/${tournament.id}` : "/tournaments"
            }
            className="ps-btn ps-btn--ghost"
          >
            {sc.backToTournament}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}