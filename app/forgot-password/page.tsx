"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { AuthLockup } from "@/app/_components/AuthLockup";
import { getDictionary, pickLocale } from "@/utils/i18n";
import { createClient } from "@/utils/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

export default function ForgotPasswordPage() {
  const dict = getDictionary(pickLocale(undefined)).auth;
  const emailId = useId();
  const statusId = useId();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setStatus({ kind: "error", message: dict.emailRequired });
      return;
    }

    setPending(true);
    setStatus({ kind: "idle" });

    try {
      const supabase = createClient();
      // Always use the canonical origin-derived redirect so this works
      // for any deployed environment (local, staging, production).
      const redirectTo = new URL("/reset-password", window.location.origin).toString();
      const { error } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        { redirectTo },
      );

      // Whether or not the email exists, show the same generic message —
      // never reveal account presence. On an error we still surface the
      // safe copy.
      if (error) {
        setStatus({ kind: "success", message: dict.resetEmailSent });
      } else {
        setStatus({ kind: "success", message: dict.resetEmailSent });
      }
      setEmail("");
    } catch {
      setStatus({ kind: "success", message: dict.resetEmailSent });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="ps-auth">
      <section className="ps-auth__card" aria-labelledby="forgot-title">
        <AuthLockup title={dict.adminBrand} subtitle="PowerStats" />

        <div className="ps-auth__heading">
          <h1 id="forgot-title">{dict.forgotPasswordTitle}</h1>
        </div>
        <p className="ps-auth__sub">{dict.forgotPasswordSubtitle}</p>

        <form onSubmit={handleSubmit} noValidate aria-describedby={statusId}>
          <div className="ps-field">
            <label htmlFor={emailId}>{dict.email}</label>
            <input
              id={emailId}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              className="ps-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={status.kind === "error"}
              disabled={pending}
            />
          </div>

          <button
            type="submit"
            className="ps-btn ps-form__submit"
            disabled={pending}
            aria-busy={pending}
          >
            {dict.sendResetLink}
          </button>

          <div id={statusId} aria-live="polite" aria-atomic="true">
            {status.kind === "error" ? (
              <p className="ps-status ps-status--error" role="alert">
                {status.message}
              </p>
            ) : null}
            {status.kind === "success" ? (
              <p className="ps-status ps-status--success" role="status">
                {status.message}
              </p>
            ) : null}
          </div>
        </form>

        <Link className="ps-back" href="/admin/login">
          ← {dict.backToLogin}
        </Link>
      </section>
    </main>
  );
}