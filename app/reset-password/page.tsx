"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { AuthLockup } from "@/app/_components/AuthLockup";
import { getDictionary, pickLocale } from "@/utils/i18n";
import { createClient } from "@/utils/supabase/client";

const MIN_PASSWORD_LENGTH = 12;

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

export default function ResetPasswordPage() {
  const router = useRouter();
  const dict = getDictionary(pickLocale(undefined)).auth;

  const newPasswordId = useId();
  const confirmId = useId();
  const statusId = useId();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // The Supabase recovery flow lands here with an active session. We
  // don't need to verify the recovery session explicitly — if the user is
  // not signed in we redirect them to the login screen with a hint.
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace("/admin/login");
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setStatus({ kind: "error", message: dict.passwordTooShort });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: dict.passwordsDoNotMatch });
      return;
    }

    setPending(true);
    setStatus({ kind: "idle" });

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setStatus({ kind: "error", message: dict.loginFailed });
        return;
      }

      // Clear local state before the redirect so the recovery session
      // is replaced with a fresh signed-out session at the login page.
      setNewPassword("");
      setConfirmPassword("");
      setStatus({ kind: "success", message: dict.passwordUpdated });

      // Brief pause so the user perceives confirmation, then navigate.
      setTimeout(() => {
        router.replace("/admin/login?message=password-updated");
      }, 400);
    } catch {
      setStatus({ kind: "error", message: dict.loginFailed });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="ps-auth">
      <section className="ps-auth__card" aria-labelledby="reset-title">
        <AuthLockup title={dict.adminBrand} subtitle="PowerStats" />

        <div className="ps-auth__heading">
          <h1 id="reset-title">{dict.resetPasswordTitle}</h1>
        </div>
        <p className="ps-auth__sub">{dict.resetPasswordSubtitle}</p>

        <form onSubmit={handleSubmit} noValidate aria-describedby={statusId}>
          <div className="ps-field">
            <label htmlFor={newPasswordId}>{dict.newPassword}</label>
            <div className="ps-field__control">
              <input
                id={newPasswordId}
                type={showPassword ? "text" : "password"}
                name="new-password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="ps-input ps-input--with-trailing"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                aria-invalid={status.kind === "error"}
                disabled={pending}
              />
              <button
                type="button"
                className="ps-field__action"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-controls={newPasswordId}
                aria-label={
                  showPassword ? dict.hidePassword : dict.showPassword
                }
                disabled={pending}
              >
                {showPassword ? dict.hidePassword : dict.showPassword}
              </button>
            </div>
          </div>

          <div className="ps-field">
            <label htmlFor={confirmId}>{dict.confirmNewPassword}</label>
            <input
              id={confirmId}
              type={showPassword ? "text" : "password"}
              name="confirm-password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="ps-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {dict.updatePassword}
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