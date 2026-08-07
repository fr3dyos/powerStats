"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";

import { AuthLockup } from "@/app/_components/AuthLockup";
import { LanguageSwitcher } from "@/app/_components/LanguageSwitcher";
import { ThemeToggle } from "@/app/_components/ThemeToggle";
import { useI18n } from "@/app/_components/I18nProvider";
import { createClient } from "@/utils/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <AdminLoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  const { dict } = useI18n();
  const auth = dict.auth;
  return (
    <main className="ps-auth">
      <section className="ps-auth__card" aria-busy="true">
<AuthLockup title={auth.adminBrand} subtitle="PowerStats" />
        <div className="ps-loading">
          <span className="ps-spinner" aria-hidden="true" />
          <span>{auth.loadingSecureSession}</span>
        </div>
      </section>
    </main>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dict } = useI18n();
  const auth = dict.auth;

  const emailId = useId();
  const passwordId = useId();
  const statusId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const passwordRef = useRef<HTMLInputElement | null>(null);

  // Show the "password updated" confirmation if the user lands here after
  // completing the reset flow.
  useEffect(() => {
    const message = searchParams?.get("message");
    if (message === "password-updated") {
      setStatus({ kind: "success", message: dict.auth.passwordUpdated });
    }
  }, [searchParams, dict.auth.passwordUpdated]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmedEmail = email.trim();
if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setStatus({ kind: "error", message: auth.emailRequired });
      return;
    }
    if (!password) {
      setStatus({ kind: "error", message: auth.passwordRequired });
      return;
    }

    setPending(true);
    setStatus({ kind: "idle" });

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        // Always return the same generic message to the UI — never echo
        // Supabase raw errors or confirm whether the email exists.
setStatus({ kind: "error", message: auth.loginFailed });
        // Clear password after a failed attempt; keep email for convenience.
        setPassword("");
        if (passwordRef.current) passwordRef.current.value = "";
        return;
      }

      // Force a router refresh so middleware-coordinated cookies propagate,
      // then send the user to the admin dashboard.
      router.replace("/admin");
      router.refresh();
    } catch {
setStatus({ kind: "error", message: auth.loginFailed });
      setPassword("");
      if (passwordRef.current) passwordRef.current.value = "";
    } finally {
      setPending(false);
    }
  }

  return (
<main className="ps-auth">
      <section className="ps-auth__card" aria-labelledby="login-title">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <AuthLockup title={auth.adminBrand} subtitle="PowerStats" />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>

        <div className="ps-auth__heading">
          <h1 id="login-title">{auth.adminAccess}</h1>
        </div>
<p className="ps-auth__sub">{auth.signInSubtitle}</p>

        <form onSubmit={handleSubmit} noValidate aria-describedby={statusId}>
          <div className="ps-field">
            <label htmlFor={emailId}>{auth.email}</label>
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

          <div className="ps-field">
            <label htmlFor={passwordId}>{auth.password}</label>
            <div className="ps-field__control">
              <input
                id={passwordId}
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                className="ps-input ps-input--with-trailing"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={status.kind === "error"}
                disabled={pending}
              />
              <button
                type="button"
                className="ps-field__action"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-controls={passwordId}
                aria-label={
                  showPassword ? auth.hidePassword : auth.showPassword
                }
                disabled={pending}
              >
                {showPassword ? auth.hidePassword : auth.showPassword}
              </button>
            </div>
          </div>

          <div className="ps-form__row">
            <Link className="ps-link" href="/forgot-password">
              {auth.forgotPassword}
            </Link>
          </div>

          <button
            type="submit"
            className="ps-btn ps-form__submit"
            disabled={pending}
            aria-busy={pending}
          >
            {auth.enterAdminPortal}
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

<Link className="ps-back" href="/">
          ← {auth.backToPowerStats}
        </Link>
      </section>
    </main>
  );
}