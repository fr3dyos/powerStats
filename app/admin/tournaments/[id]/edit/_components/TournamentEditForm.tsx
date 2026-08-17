"use client";

import { useState } from "react";
import Link from "next/link";
import type { Tournament, Phase, Team } from "@/utils/api-shared";

import PhaseEditor from "./PhaseEditor";
import TeamsAndPlayersPanel from "./TeamsAndPlayersPanel";
import TeamsBulkImportPanel from "./TeamsBulkImportPanel";

type Props = {
  tournament: Tournament;
  phases: Phase[];
  teams: Team[];
  labels: {
    name: string;
    location: string;
    description: string;
    startDate: string;
    endDate: string;
    save: string;
    cancel: string;
    phases: string;
    addPhase: string;
    phaseName: string;
    phaseType: string;
    phaseStatus: string;
    phaseRoundRobin: string;
    phaseBracket: string;
    phasePending: string;
    phaseInProgress: string;
    phaseCompleted: string;
    generateRoundRobin: string;
    generateBracket: string;
    viewStandings: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
    suggestSchedule: string;
    suggestScheduleFailed: string;
    suggestScheduleSuccess: string;
    suggestScheduleFieldCount: string;
    groupCount: string;
    advancingTeams: string;
    tiebreakers: string;
    teams: string;
    addTeam: string;
    teamName: string;
    players: string;
    importRoster: string;
    uploadCSVXLSX: string;
    dragDropHint: string;
    selectFile: string;
    submit: string;
    loading: string;
    bulkImportColumnHelp: string;
    bulkImportSummary: string;
    exportCsv: string;
    previewImport: string;
    confirmImport: string;
    backToIdle: string;
    teamsToCreate: string;
    playersToCreate: string;
    rowErrors: string;
    gender: string;
    nationality: string;
    other: string;
    teamColumn: string;
    nameColumn: string;
    lastnameColumn: string;
    numberColumn: string;
    mappingTitle: string;
    mappingHelp: string;
    noColumn: string;
    requiredField: string;
    removeRow: string;
    newTeam: string;
    rowInvalid: string;
    bulkImportTeamsColumnHelp: string;
    bulkImportTeamsSummary: string;
  };
  canEdit: boolean;
};

export function TournamentEditForm({
  tournament,
  phases: initialPhases,
  teams: initialTeams,
  labels,
  canEdit,
}: Props) {
  const [formData, setFormData] = useState({
    name: tournament.name,
    location: tournament.location || "",
    description: tournament.description || "",
    start_date: tournament.start_date?.split("T")[0] || "",
    end_date: tournament.end_date?.split("T")[0] || "",
  });
  const [phases, setPhases] = useState<Phase[]>(initialPhases);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showAddPhaseModal, setShowAddPhaseModal] = useState(false);
  const [newPhaseData, setNewPhaseData] = useState({
    name: "",
    phase_type: "round_robin" as "round_robin" | "bracket",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to update");

      setMessage("Tournament updated successfully!");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhase = async () => {
    if (!canEdit) return;

    if (!newPhaseData.name.trim()) {
      setMessage("Phase name is required");
      return;
    }

    try {
      const res = await fetch(
        `/api/tournaments/${tournament.id}/phases`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newPhaseData.name,
            phase_order: phases.length + 1,
            phase_type: newPhaseData.phase_type,
            status: "pending",
            status_mode: "auto",
            config: {
              group_count: 2,
              advancing_teams: 2,
              tiebreakers: ["head_to_head", "point_diff"],
            },
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to create phase");

      const newPhase = await res.json();
      setPhases([...phases, newPhase]);
      setShowAddPhaseModal(false);
      setNewPhaseData({ name: "", phase_type: "round_robin" });
      setMessage("Phase added successfully!");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to add phase");
    }
  };

  const handlePhaseChange = (next: Phase) => {
    setPhases((curr) => curr.map((p) => (p.id === next.id ? next : p)));
  };

  const handlePhaseDelete = (phaseId: number) => {
    setPhases((curr) => curr.filter((p) => p.id !== phaseId));
  };

  const handleGenerateFixtures = async (
    phaseId: number,
    type: "round-robin" | "bracket",
  ) => {
    if (!canEdit) return;

    const endpoint =
      type === "round-robin"
        ? `/api/phases/${phaseId}/round-robin`
        : `/api/phases/${phaseId}/bracket`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persist: true }),
      });

      if (!res.ok) throw new Error(`Failed to generate ${type}`);

      setMessage(`${type} generated successfully!`);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : `Failed to generate ${type}`,
      );
    }
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <form onSubmit={handleSubmit} className="ps-card">
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Tournament Details</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              {labels.name}
            </label>
            <input
              type="text"
              className="ps-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!canEdit}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              {labels.location}
            </label>
            <input
              type="text"
              className="ps-input"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              disabled={!canEdit}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              {labels.startDate}
            </label>
            <input
              type="date"
              className="ps-input"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              disabled={!canEdit}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              {labels.endDate}
            </label>
            <input
              type="date"
              className="ps-input"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              disabled={!canEdit}
              required
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
            {labels.description}
          </label>
          <textarea
            className="ps-input"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            disabled={!canEdit}
            rows={3}
          />
        </div>

        {canEdit && (
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="submit" className="ps-btn ps-btn--primary" disabled={saving}>
              {saving ? "Saving..." : labels.save}
            </button>
          </div>
        )}

        {message && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 4,
              background: message.includes("successfully")
                ? "rgba(76, 175, 80, 0.1)"
                : "rgba(244, 67, 54, 0.1)",
              color: message.includes("successfully") ? "#2E7D32" : "#F44336",
            }}
          >
            {message}
          </div>
        )}
      </form>

      <TeamsBulkImportPanel
        tournamentId={tournament.id}
        labels={{
          importRoster: labels.importRoster,
          uploadCSVXLSX: labels.uploadCSVXLSX,
          dragDropHint: labels.dragDropHint,
          submit: labels.submit,
          cancel: labels.cancel,
          loading: labels.loading,
          previewImport: labels.previewImport,
          confirmImport: labels.confirmImport,
          backToIdle: labels.backToIdle,
          teamsToCreate: labels.teamsToCreate,
          rowErrors: labels.rowErrors,
          mappingTitle: labels.mappingTitle,
          mappingHelp: labels.bulkImportTeamsColumnHelp,
          noColumn: labels.noColumn,
          requiredField: labels.requiredField,
          removeRow: labels.removeRow,
          newTeam: labels.newTeam,
          rowInvalid: labels.rowInvalid,
        }}
      />

      <TeamsAndPlayersPanel
        tournamentId={tournament.id}
        teams={teams}
        onTeamsUpdated={(t: Team[]) => setTeams(t)}
        labels={{
          teams: labels.teams,
          addTeam: labels.addTeam,
          teamName: labels.teamName,
          players: labels.players,
          importRoster: labels.importRoster,
          uploadCSVXLSX: labels.uploadCSVXLSX,
          dragDropHint: labels.dragDropHint,
          selectFile: labels.selectFile,
          submit: labels.submit,
          cancel: labels.cancel,
          loading: labels.loading,
          bulkImportColumnHelp: labels.bulkImportColumnHelp,
          bulkImportSummary: labels.bulkImportSummary,
          exportCsv: labels.exportCsv,
          previewImport: labels.previewImport,
          confirmImport: labels.confirmImport,
          backToIdle: labels.backToIdle,
          teamsToCreate: labels.teamsToCreate,
          playersToCreate: labels.playersToCreate,
          rowErrors: labels.rowErrors,
          gender: labels.gender,
          nationality: labels.nationality,
          other: labels.other,
          teamColumn: labels.teamColumn,
          nameColumn: labels.nameColumn,
          lastnameColumn: labels.lastnameColumn,
          numberColumn: labels.numberColumn,
          mappingTitle: labels.mappingTitle,
          mappingHelp: labels.mappingHelp,
          noColumn: labels.noColumn,
          requiredField: labels.requiredField,
          removeRow: labels.removeRow,
          newTeam: labels.newTeam,
          rowInvalid: labels.rowInvalid,
        }}
      />

      {/* Phases Section */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 18, margin: 0 }}>{labels.phases}</h2>
          {canEdit && (
            <button
              type="button"
              className="ps-btn ps-btn--secondary"
              onClick={() => setShowAddPhaseModal(true)}
            >
              {labels.addPhase}
            </button>
          )}
        </div>

        {showAddPhaseModal && (
          <div
            style={{
              padding: 16,
              marginBottom: 16,
              border: "1px solid var(--ps-border)",
              borderRadius: 8,
              background: "var(--ps-surface-container-low)",
            }}
          >
            <h3 style={{ fontSize: 14, margin: "0 0 12px 0" }}>{labels.addPhase}</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 12 }}>
                  {labels.phaseName}
                </label>
                <input
                  type="text"
                  className="ps-input"
                  value={newPhaseData.name}
                  onChange={(e) =>
                    setNewPhaseData({ ...newPhaseData, name: e.target.value })
                  }
                  placeholder="e.g., Groups, Playoffs"
                  style={{ fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 12 }}>
                  {labels.phaseType}
                </label>
                <select
                  value={newPhaseData.phase_type}
                  onChange={(e) =>
                    setNewPhaseData({
                      ...newPhaseData,
                      phase_type: e.target.value as "round_robin" | "bracket",
                    })
                  }
                  className="ps-input"
                  style={{ fontSize: 13 }}
                >
                  <option value="round_robin">{labels.phaseRoundRobin}</option>
                  <option value="bracket">{labels.phaseBracket}</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="ps-btn ps-btn--primary"
                onClick={handleAddPhase}
                style={{ fontSize: 12 }}
              >
                {labels.addPhase}
              </button>
              <button
                type="button"
                className="ps-btn ps-btn--ghost"
                onClick={() => {
                  setShowAddPhaseModal(false);
                  setNewPhaseData({ name: "", phase_type: "round_robin" });
                }}
                style={{ fontSize: 12 }}
              >
                {labels.cancel}
              </button>
            </div>
          </div>
        )}

        {phases.length === 0 ? (
          <p style={{ color: "var(--ps-text-muted)" }}>
            No phases configured. Add a phase to start building the tournament structure.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {phases.map((phase) => (
              <PhaseEditor
                key={phase.id}
                phase={phase}
                tournamentId={tournament.id}
                canEdit={canEdit}
                onChange={handlePhaseChange}
                onDelete={handlePhaseDelete}
                labels={{
                  name: labels.phaseName,
                  phaseType: labels.phaseType,
                  phaseStatus: labels.phaseStatus,
                  phaseRoundRobin: labels.phaseRoundRobin,
                  phaseBracket: labels.phaseBracket,
                  phasePending: labels.phasePending,
                  phaseInProgress: labels.phaseInProgress,
                  phaseCompleted: labels.phaseCompleted,
                  generateRoundRobin: labels.generateRoundRobin,
                  generateBracket: labels.generateBracket,
                  viewStandings: labels.viewStandings,
                  edit: labels.edit,
                  save: labels.save,
                  cancel: labels.cancel,
                  delete: labels.delete,
                  deleteConfirm: labels.deleteConfirm,
                  suggestSchedule: labels.suggestSchedule,
                  suggestScheduleFailed: labels.suggestScheduleFailed,
                  suggestScheduleSuccess: labels.suggestScheduleSuccess,
                  suggestScheduleFieldCount: labels.suggestScheduleFieldCount,
                  groupCount: labels.groupCount,
                  advancingTeams: labels.advancingTeams,
                  tiebreakers: labels.tiebreakers,
                }}
              />
            ))}
          </div>
        )}
    </div>
  );
}
