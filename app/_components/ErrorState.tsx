import Link from "next/link";

/**
 * Shared error-state panel for public data pages.
 *
 * Rendered when a network / DB fetch fails so the user sees a friendly,
 * branded message with a retry-esque action instead of a blank page.
 * All colors come from `--ps-*` theme tokens so it adapts to dark/light.
 */
export function ErrorState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "64px 24px",
        minHeight: 320,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 96,
          height: 96,
          margin: "0 auto 24px",
          borderRadius: "9999px",
          background: "var(--ps-danger-soft)",
          border: "1px solid var(--ps-danger)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
          fontWeight: 800,
          fontFamily: "var(--ps-font-display)",
          color: "var(--ps-danger)",
        }}
      >
        !
      </div>
      <h1
        style={{
          fontSize: "clamp(24px, 4vw, 32px)",
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
            fontSize: 15,
            lineHeight: 1.6,
            maxWidth: 460,
            margin: "0 auto 28px",
          }}
        >
          {description}
        </p>
      ) : null}
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="ps-btn ps-btn--primary">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
