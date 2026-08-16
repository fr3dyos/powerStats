"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Labels = {
  name: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string;
  create: string;
  cancel: string;
  saving: string;
};

export function NewTournamentForm({ labels }: { labels: Labels }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    description: "",
    start_date: "",
    end_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      // Convert date strings to ISO 8601 datetime (midnight UTC).
      // FastAPI expects datetime objects, which JSON serializes as ISO 8601 strings.
      const payload = {
        name: formData.name,
        location: formData.location || null,
        description: formData.description || null,
        start_date: formData.start_date ? `${formData.start_date}T00:00:00Z` : null,
        end_date: formData.end_date ? `${formData.end_date}T00:00:00Z` : null,
      };

      // Validate that both dates are provided if either is provided.
      if ((payload.start_date && !payload.end_date) || (!payload.start_date && payload.end_date)) {
        throw new Error("Both start and end dates are required");
      }

      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? "Failed to create tournament");
      }

      const created = await res.json();
      setMessage({ ok: true, text: "Tournament created!" });
      // Navigate to the edit page after a brief delay so the user sees the success message.
      setTimeout(() => router.push(`/admin/tournaments/${created.id}/edit`), 800);
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Create failed",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="ps-card" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>{labels.create}</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
            {labels.name} *
          </label>
          <input
            type="text"
            className="ps-input"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
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
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
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
            onChange={(e) =>
              setFormData({ ...formData, start_date: e.target.value })
            }
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
            onChange={(e) =>
              setFormData({ ...formData, end_date: e.target.value })
            }
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
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={3}
        />
      </div>

      {message && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 4,
            background: message.ok
              ? "rgba(76, 175, 80, 0.1)"
              : "rgba(244, 67, 54, 0.1)",
            color: message.ok ? "#2E7D32" : "#F44336",
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          type="submit"
          className="ps-btn ps-btn--primary"
          disabled={saving}
        >
          {saving ? labels.saving : labels.create}
        </button>
        <button
          type="button"
          className="ps-btn ps-btn--ghost"
          onClick={() => router.push("/admin/tournaments")}
          disabled={saving}
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
