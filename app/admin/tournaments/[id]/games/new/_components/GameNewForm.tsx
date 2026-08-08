"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createGameAction,
  createGamesBatchAction,
} from "../../../../../games/_actions";
import type { Team } from "@/utils/api-shared";
import type { GameCreateInput } from "@/utils/api";

type TeamlessGame = Omit<GameCreateInput, "tournament_id">;

type GameNewFormProps = {
  tournamentId: number;
  teams: Team[];
  copy: {
    singleGame: string;
    bulkUpload: string;
    homeTeam: string;
    awayTeam: string;
    selectTeam: string;
    startTime: string;
    fieldNumber: string;
    gameRule: string;
    ruleTimeLimit: string;
    ruleScoreLimit: string;
    timeLimit: string;
    scoreLimit: string;
    requiredFields: string;
    sameTeam: string;
    gameCreated: string;
    gameCreateFailed: string;
    csvInstructions: string;
    downloadTemplate: string;
    invalidCsv: string;
    gamesCreated: string;
    gamesCreateFailed: string;
    save: string;
    cancel: string;
  };
};

/** Minimal CSV parser that handles quoted fields and CRLF line endings. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

const EXPECTED_HEADERS = ["home_team", "away_team", "start_time", "field_number", "score_limit", "time_limit"];

export default function GameNewForm({ tournamentId, teams, copy }: GameNewFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"single" | "bulk">("single");

  // Single-game fields
  const [homeId, setHomeId] = useState<string>("");
  const [awayId, setAwayId] = useState<string>("");
  const [startTime, setStartTime] = useState("");
  const [fieldNumber, setFieldNumber] = useState("");
  const [gameRule, setGameRule] = useState<"TIME_LIMIT" | "SCORE_LIMIT">("SCORE_LIMIT");
  const [timeLimit, setTimeLimit] = useState("");
  const [scoreLimit, setScoreLimit] = useState("");

  // Bulk fields
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<TeamlessGame[] | null>(null);
  const [bulkDropped, setBulkDropped] = useState<string[]>([]);

  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );
  const teamByName = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams) map.set(t.name.trim().toLowerCase(), t);
    return map;
  }, [teams]);

  function parseBulk(raw: string) {
    const rows = parseCsv(raw);
    if (rows.length === 0) {
      setBulkPreview(null);
      setBulkDropped([]);
      return;
    }
    // Skip a header row when the first row looks like our template headers.
    let start = 0;
    const firstLower = rows[0].map((c) => c.trim().toLowerCase());
    if (EXPECTED_HEADERS.some((h) => firstLower.includes(h))) start = 1;

    const games: TeamlessGame[] = [];
    const dropped: string[] = [];
    for (const row of rows.slice(start)) {
      const [homeName, awayName, startTimeRaw, fieldRaw, scoreRaw, timeRaw] = row;
      const home = teamByName.get((homeName ?? "").trim().toLowerCase());
      const away = teamByName.get((awayName ?? "").trim().toLowerCase());
      if (!home || !away || home.id === away.id) {
        dropped.push(row.map((c) => c.trim()).join(" | ") || "(empty row)");
        continue;
      }
      const scoreLimitNum = scoreRaw ? Number(scoreRaw) : NaN;
      const timeLimitNum = timeRaw ? Number(timeRaw) : NaN;
      const hasScore = Number.isInteger(scoreLimitNum) && scoreLimitNum > 0;
      const hasTime = Number.isInteger(timeLimitNum) && timeLimitNum > 0;
      if (!hasScore && !hasTime) {
        dropped.push(row.map((c) => c.trim()).join(" | "));
        continue;
      }
      const fieldNum = fieldRaw ? Number(fieldRaw) : NaN;
      const game: TeamlessGame = {
        home_team_id: home.id,
        away_team_id: away.id,
        // Ultimate defaults to score-limit with an optional time cap.
        game_rule: hasTime && !hasScore ? "TIME_LIMIT" : "SCORE_LIMIT",
        score_limit: hasScore ? scoreLimitNum : null,
        time_limit: hasTime ? timeLimitNum : null,
        field_number: Number.isInteger(fieldNum) && fieldNum > 0 ? fieldNum : null,
      };
      if (startTimeRaw && startTimeRaw.trim()) {
        const parsed = new Date(startTimeRaw.trim());
        if (!Number.isNaN(parsed.getTime())) {
          game.start_time = parsed.toISOString();
        }
      }
      games.push(game);
    }
    setBulkPreview(games);
    setBulkDropped(dropped);
  }

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setBulkText(text);
      parseBulk(text);
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const header = EXPECTED_HEADERS.join(",");
    const sample = sortedTeams
      .slice(0, 2)
      .map((t) => t.name)
      .join(",");
    const csv = `${header}\n${sample},2026-08-08 09:00,1,15,90\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "games-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSingleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!homeId || !awayId) {
      setFeedback({ ok: false, msg: copy.requiredFields });
      return;
    }
    if (homeId === awayId) {
      setFeedback({ ok: false, msg: copy.sameTeam });
      return;
    }
    if (gameRule === "TIME_LIMIT" && !timeLimit.trim()) {
      setFeedback({ ok: false, msg: copy.requiredFields });
      return;
    }
    if (gameRule === "SCORE_LIMIT" && !scoreLimit.trim()) {
      setFeedback({ ok: false, msg: copy.requiredFields });
      return;
    }

    const formData = new FormData();
    formData.set("tournament_id", String(tournamentId));
    formData.set("home_team_id", homeId);
    formData.set("away_team_id", awayId);
    formData.set("game_rule", gameRule);
    if (startTime) formData.set("start_time", startTime);
    if (fieldNumber.trim()) formData.set("field_number", fieldNumber.trim());
    if (gameRule === "TIME_LIMIT") formData.set("time_limit", timeLimit.trim());
    if (gameRule === "SCORE_LIMIT") formData.set("score_limit", scoreLimit.trim());

    startTransition(async () => {
      const result = await createGameAction(formData);
      if (result.ok === true) {
        setFeedback({ ok: true, msg: copy.gameCreated });
        setHomeId("");
        setAwayId("");
        setStartTime("");
        setFieldNumber("");
        setTimeLimit("");
        setScoreLimit("");
        router.refresh();
        return;
      }
      const messageKey =
        result.error === "requiredFields"
          ? copy.requiredFields
          : result.error === "sameTeam"
            ? copy.sameTeam
            : copy.gameCreateFailed;
      setFeedback({ ok: false, msg: messageKey });
    });
  }

  function handleBulkSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!bulkPreview || bulkPreview.length === 0) {
      setFeedback({ ok: false, msg: copy.invalidCsv });
      return;
    }

    startTransition(async () => {
      const result = await createGamesBatchAction(tournamentId, bulkPreview);
      if (result.ok === true) {
        setFeedback({
          ok: true,
          msg: copy.gamesCreated.replace("{count}", String(result.created)),
        });
        setBulkText("");
        setBulkPreview(null);
        setBulkDropped([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
        return;
      }
      const messageKey =
        result.error === "invalidCsv" ? copy.invalidCsv : copy.gamesCreateFailed;
      setFeedback({ ok: false, msg: messageKey });
    });
  }

  return (
    <div className="ps-card" style={{ marginTop: 16, padding: 16 }}>
      {/* Mode switcher */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          className={`ps-btn ${mode === "single" ? "ps-btn--primary" : "ps-btn--ghost"}`}
          onClick={() => {
            setMode("single");
            setFeedback(null);
          }}
        >
          {copy.singleGame}
        </button>
        <button
          type="button"
          className={`ps-btn ${mode === "bulk" ? "ps-btn--primary" : "ps-btn--ghost"}`}
          onClick={() => {
            setMode("bulk");
            setFeedback(null);
          }}
        >
          {copy.bulkUpload}
        </button>
      </div>

      {mode === "single" ? (
        <form
          onSubmit={handleSingleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.homeTeam}</span>
              <select
                value={homeId}
                onChange={(e) => setHomeId(e.target.value)}
                className="ps-input"
                required
              >
                <option value="">{copy.selectTeam}</option>
                {sortedTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.awayTeam}</span>
              <select
                value={awayId}
                onChange={(e) => setAwayId(e.target.value)}
                className="ps-input"
                required
              >
                <option value="">{copy.selectTeam}</option>
                {sortedTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.startTime}</span>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="ps-input"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.fieldNumber}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={fieldNumber}
                onChange={(e) => setFieldNumber(e.target.value)}
                className="ps-input"
                placeholder="1"
                autoComplete="off"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.gameRule}</span>
              <select
                value={gameRule}
                onChange={(e) =>
                  setGameRule(e.target.value as "TIME_LIMIT" | "SCORE_LIMIT")
                }
                className="ps-input"
              >
                <option value="SCORE_LIMIT">{copy.ruleScoreLimit}</option>
                <option value="TIME_LIMIT">{copy.ruleTimeLimit}</option>
              </select>
            </label>
            {gameRule === "TIME_LIMIT" ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.timeLimit}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  className="ps-input"
                  required
                  autoComplete="off"
                />
              </label>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.scoreLimit}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={scoreLimit}
                  onChange={(e) => setScoreLimit(e.target.value)}
                  className="ps-input"
                  required
                  autoComplete="off"
                />
              </label>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="submit"
              className="ps-btn ps-btn--primary"
              disabled={isPending}
            >
              {isPending ? "…" : copy.save}
            </button>
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={() => router.push("/admin/tournaments")}
              disabled={isPending}
            >
              {copy.cancel}
            </button>
            {feedback ? (
              <span
                role={feedback.ok ? "status" : "alert"}
                style={{
                  fontSize: 13,
                  color: feedback.ok ? "var(--ps-success, #2e7d32)" : "var(--ps-error, #c62828)",
                }}
              >
                {feedback.msg}
              </span>
            ) : null}
          </div>
        </form>
      ) : (
        <form
          onSubmit={handleBulkSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <p style={{ fontSize: 13, color: "var(--ps-text-muted)", margin: 0 }}>
            {copy.csvInstructions}
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="ps-input"
              style={{ maxWidth: 360 }}
            />
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={downloadTemplate}
            >
              {copy.downloadTemplate}
            </button>
          </div>

          {bulkPreview && bulkPreview.length > 0 ? (
            <div
              style={{
                border: "1px solid var(--ps-border-strong)",
                borderRadius: "var(--ps-radius)",
                overflow: "hidden",
              }}
            >
              <table className="ps-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>{copy.homeTeam}</th>
                    <th>{copy.awayTeam}</th>
                    <th>{copy.startTime}</th>
                    <th>{copy.fieldNumber}</th>
                    <th>{copy.scoreLimit}</th>
                    <th>{copy.timeLimit}</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkPreview.map((g, i) => {
                    const home = teamByName.get(
                      String(sortedTeams.find((t) => t.id === g.home_team_id)?.name ?? "").toLowerCase(),
                    );
                    const away = teamByName.get(
                      String(sortedTeams.find((t) => t.id === g.away_team_id)?.name ?? "").toLowerCase(),
                    );
                    return (
                      <tr key={i}>
                        <td>{home?.name ?? g.home_team_id}</td>
                        <td>{away?.name ?? g.away_team_id}</td>
                        <td>{g.start_time ? new Date(g.start_time).toLocaleString() : "—"}</td>
                        <td>{g.field_number ?? "—"}</td>
                        <td>{g.score_limit ?? "—"}</td>
                        <td>{g.time_limit ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : bulkText ? (
            <p style={{ fontSize: 13, color: "var(--ps-error, #c62828)", margin: 0 }}>
              {copy.invalidCsv}
            </p>
          ) : null}

          {bulkDropped.length > 0 ? (
            <p style={{ fontSize: 12, color: "var(--ps-text-muted)", margin: 0 }}>
              {bulkDropped.length} row(s) skipped: {bulkDropped.slice(0, 3).join(" · ")}
              {bulkDropped.length > 3 ? " …" : ""}
            </p>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="submit"
              className="ps-btn ps-btn--primary"
              disabled={isPending || !bulkPreview || bulkPreview.length === 0}
            >
              {isPending ? "…" : copy.save}
            </button>
            <button
              type="button"
              className="ps-btn ps-btn--ghost"
              onClick={() => {
                setBulkText("");
                setBulkPreview(null);
                setBulkDropped([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={isPending}
            >
              {copy.cancel}
            </button>
            {feedback ? (
              <span
                role={feedback.ok ? "status" : "alert"}
                style={{
                  fontSize: 13,
                  color: feedback.ok ? "var(--ps-success, #2e7d32)" : "var(--ps-error, #c62828)",
                }}
              >
                {feedback.msg}
              </span>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
