import Link from "next/link";

/**
 * Shared empty-state / not-found panel.
 *
 * Visual basis: the "Player Not Found / Empty State" Stitch template in
 * `NewPages/player_not_found_empty_state/`. Rendered on genuinely missing
 * records (player, team, tournament) and on empty data lists so the UI
 * never shows a blank page.
 *
 * All colors come from `--ps-*` theme tokens so it adapts to dark/light.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  secondaryLabel,
  secondaryHref,
  actionMode = "primary",
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  actionMode?: "primary" | "secondary";
}) {
  return (
    <div
      className="ps-empty"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "64px 24px",
        minHeight: 320,
        overflow: "hidden",
      }}
    >
      {/* Decorative concentric rings (brand-tinted, low opacity). */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.1,
        }}
      >
        <div
          style={{
            width: "80vw",
            maxWidth: 640,
            height: "80vw",
            maxHeight: 640,
            borderRadius: "9999px",
            border: "1px solid var(--ps-primary-container)",
            position: "absolute",
          }}
        />
        <div
          style={{
            width: "60vw",
            maxWidth: 480,
            height: "60vw",
            maxHeight: 480,
            borderRadius: "9999px",
            border: "1px solid var(--ps-tertiary-container)",
            position: "absolute",
          }}
        />
        <div
          style={{
            width: "40vw",
            maxWidth: 320,
            height: "40vw",
            maxHeight: 320,
            borderRadius: "9999px",
            border: "1px solid var(--ps-primary-container)",
            position: "absolute",
            opacity: 0.5,
          }}
        />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 560,
          width: "100%",
        }}
      >
        {/* Illustrative disc glyph. */}
        <div
          aria-hidden="true"
          style={{
            width: 96,
            height: 96,
            margin: "0 auto 24px",
            borderRadius: "9999px",
            background: "var(--ps-surface-container-high)",
            border: "1px solid var(--ps-outline)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            fontWeight: 800,
            fontFamily: "var(--ps-font-display)",
            color: "var(--ps-primary-container)",
            boxShadow: "0 0 40px rgba(255,87,34,0.1)",
          }}
        >
          ✳
        </div>

        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 40px)",
            fontWeight: 800,
            color: "var(--ps-text)",
            margin: "0 0 12px",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>

        {description ? (
          <p
            style={{
              color: "var(--ps-text-muted)",
              fontSize: 16,
              lineHeight: 1.6,
              maxWidth: 460,
              margin: "0 auto 28px",
            }}
          >
            {description}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
          }}
        >
          {actionLabel && actionHref ? (
            <Link
              href={actionHref}
              className={
                actionMode === "primary"
                  ? "ps-btn ps-btn--primary"
                  : "ps-btn ps-btn--secondary"
              }
            >
              {actionLabel}
            </Link>
          ) : null}
          {secondaryLabel && secondaryHref ? (
            <Link href={secondaryHref} className="ps-btn">
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
