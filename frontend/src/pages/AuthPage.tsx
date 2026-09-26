import { useState } from "react";
import type { SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { Banner, Field, Mark, btnGhost, btnPrimary } from "../components/ui";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { login, meta, setSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState("");
  const [delivery, setDelivery] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function afterLogin(userStep: string) {
    navigate(userStep === "done" ? "/discover" : "/onboarding");
  }

  async function onLogin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(email, password);
      await afterLogin(user.onboarding_step);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = await api<{ preview_code?: string; delivery: string }>("/api/auth/email/start", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setDelivery(body.delivery);
      setPreview(body.preview_code || "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send a code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = await api<{ verification_token: string }>("/api/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setVerificationToken(body.verification_token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function register(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = await api<{ token: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, verification_token: verificationToken }),
      });
      const user = await setSession(body.token);
      await afterLogin(user.onboarding_step);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-screen items-stretch md:grid-cols-2">
      <section className="hidden flex-col justify-center bg-navy px-10 py-12 text-paper md:flex">
        <Link to="/" className="flex items-center gap-2">
          <Mark />
          <span className="font-serif text-2xl">Nook</span>
        </Link>
        <div>
          <p className="font-serif text-5xl leading-tight">A couch with a person attached.</p>
        </div>
      </section>
      <section className="px-5 py-10 md:px-12">
        <Link to="/" className="mb-8 flex items-center gap-2 md:hidden">
          <Mark />
          <span className="font-serif text-2xl">Nook</span>
        </Link>
        <div className="mb-6 flex gap-2">
          <Link to="/login" className={mode === "login" ? btnPrimary : btnGhost}>
            Log in
          </Link>
          <Link to="/signup" className={mode === "signup" ? btnPrimary : btnGhost}>
            New account
          </Link>
        </div>
        {error ? (
          <div className="mb-4">
            <Banner>{error}</Banner>
          </div>
        ) : null}
        {mode === "login" ? (
          <form className="space-y-4" onSubmit={onLogin}>
            <Field label="Georgia Tech email">
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@gatech.edu" required />
            </Field>
            <Field label="Password">
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
            <button className={btnPrimary} disabled={busy} type="submit">
              {busy ? "Checking…" : "Log in"}
            </button>

            <p className="text-sm text-muted">Don't have an account? <Link to="/signup" className="text-navy">Sign up</Link></p>
          </form>
        ) : !preview && !verificationToken ? (
          <form className="space-y-4" onSubmit={sendCode}>
            <Field label="Georgia Tech email">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@gatech.edu" required />
            </Field>
            <p className="text-sm text-muted">We'll send a 6-digit code before you can create a password.</p>
            <button className={btnPrimary} disabled={busy} type="submit">
              {busy ? "Sending…" : "Email me a code"}
            </button>

            <p className="text-sm text-muted">Already have an account? <Link to="/login" className="text-navy">Log in</Link></p>
          </form>
        ) : !verificationToken ? (
          <form className="space-y-4" onSubmit={verify}>
            {delivery === "preview" ? (
              <Banner tone="note">
                Mail isn't configured, so the code that would have been emailed to {email} is <strong>{preview}</strong>. Add SMTP settings to send it for real.
              </Banner>
            ) : (
              <Banner tone="note">Check {email} for a 6-digit code. It expires in 15 minutes.</Banner>
            )}
            <Field label="Code">
              <input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} required />
            </Field>
            <button className={btnPrimary} disabled={busy} type="submit">
              Verify email
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={register}>
            <p className="text-sm text-muted">{email} is verified. Set a password with at least 8 characters, a letter, and a number.</p>
            <Field label="Password">
              <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
            <button className={btnPrimary} disabled={busy} type="submit">
              Create account
            </button>
          </form>
        )}
        {mode === "login" && meta?.demo && meta.demo_accounts ? (
          <div className="mt-6 space-y-2">
            <p className="text-xs tracking-[0.16em] text-gold uppercase">Demo Jackets</p>
            {meta.demo_accounts.map((account) => (
              <button
                key={account.email}
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-left text-sm hover:border-navy"
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const user = await login(account.email, meta.demo_password || "");
                    await afterLogin(user.onboarding_step);
                  } catch (err) {
                    setError(err instanceof ApiError ? err.message : "Demo login failed.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <span>
                  <span className="block font-medium">{account.name}</span>
                  <span className="text-muted">{account.blurb}</span>
                </span>
                <span className="text-navy">Enter</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}