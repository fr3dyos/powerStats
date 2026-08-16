"use client";

import { useState, useTransition } from "react";

import { usersApi, type AuthUser } from "@/utils/api";

type Labels = {
  email: string;
  role: string;
  createdAt: string;
  lastSignIn: string;
  actions: string;
  save: string;
  saved: string;
  saveFailed: string;
  selectRole: string;
  roleAdmin: string;
  roleScorekeeper: string;
  rolePublic: string;
};

type Props = {
  users: AuthUser[];
  currentUserId: string;
  labels: Labels;
};

type Row = AuthUser & {
  _pending?: boolean;
  _error?: string;
  _saved?: boolean;
};

/**
 * Editable user-table.  Inline `<select>` for the role with optimistic
 * update + revert on failure.  The current user is rendered without a
 * `<select>` so an admin cannot lock themselves out of the panel by
 * demoting their own account.
 */
export default function AdminUsersTable({ users, currentUserId, labels }: Props) {
  const [rows, setRows] = useState<Row[]>(users);
  const [, startTransition] = useTransition();

  const updateRole = (userId: string, nextRole: AuthUser["role"]) => {
    const idx = rows.findIndex((r) => r.id === userId);
    if (idx < 0) return;
    const prev = rows[idx];
    // Optimistic update.
    setRows((curr) =>
      curr.map((r) =>
        r.id === userId
          ? { ...r, role: nextRole, _pending: true, _error: undefined, _saved: false }
          : r,
      ),
    );
    startTransition(async () => {
      try {
        const updated = await usersApi.updateRole(userId, nextRole);
        setRows((curr) =>
          curr.map((r) =>
            r.id === userId
              ? { ...updated, _pending: false, _saved: true, _error: undefined }
              : r,
          ),
        );
        // Clear "saved" pill after 2s.
        setTimeout(() => {
          setRows((curr) =>
            curr.map((r) => (r.id === userId ? { ...r, _saved: false } : r)),
          );
        }, 2000);
      } catch (err) {
        const detail = err instanceof Error ? err.message : labels.saveFailed;
        // Revert + surface the error.
        setRows((curr) =>
          curr.map((r) =>
            r.id === userId
              ? { ...prev, _pending: false, _error: detail }
              : r,
          ),
        );
      }
    });
  };

  return (
    <div className="ps-card" style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
        }}
      >
        <thead>
          <tr style={{ textAlign: "left", color: "var(--ps-text-muted)" }}>
            <th style={{ padding: "8px 12px" }}>{labels.email}</th>
            <th style={{ padding: "8px 12px" }}>{labels.role}</th>
            <th style={{ padding: "8px 12px" }}>{labels.createdAt}</th>
            <th style={{ padding: "8px 12px" }}>{labels.lastSignIn}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <tr key={u.id} style={{ borderTop: "1px solid var(--ps-divider)" }}>
                <td style={{ padding: "8px 12px" }}>
                  {u.email}
                  {isSelf ? (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 12,
                        color: "var(--ps-text-muted)",
                      }}
                    >
                      (you)
                    </span>
                  ) : null}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {isSelf ? (
                    <span>{labelForRole(u.role, labels)}</span>
                  ) : (
                    <select
                      aria-label={labels.selectRole}
                      value={u.role}
                      disabled={u._pending}
                      onChange={(e) =>
                        updateRole(u.id, e.target.value as AuthUser["role"])
                      }
                      style={{
                        padding: "4px 8px",
                        borderRadius: "var(--ps-radius)",
                        border: "1px solid var(--ps-divider)",
                        background: "var(--ps-surface-container-low)",
                        color: "var(--ps-text)",
                      }}
                    >
                      <option value="admin">{labels.roleAdmin}</option>
                      <option value="scorekeeper">{labels.roleScorekeeper}</option>
                      <option value="public">{labels.rolePublic}</option>
                    </select>
                  )}
                  {u._error ? (
                    <div
                      role="alert"
                      style={{
                        color: "var(--ps-error, #c0392b)",
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {u._error}
                    </div>
                  ) : null}
                  {u._saved ? (
                    <div
                      style={{
                        color: "var(--ps-success, #1f7a3a)",
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {labels.saved}
                    </div>
                  ) : null}
                </td>
                <td style={{ padding: "8px 12px", color: "var(--ps-text-muted)" }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "var(--ps-text-muted)" }}>
                  {u.last_sign_in_at
                    ? new Date(u.last_sign_in_at).toLocaleString()
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function labelForRole(role: AuthUser["role"], labels: Labels): string {
  switch (role) {
    case "admin":
      return labels.roleAdmin;
    case "scorekeeper":
      return labels.roleScorekeeper;
    default:
      return labels.rolePublic;
  }
}
