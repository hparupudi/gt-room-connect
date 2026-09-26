import { useState, useEffect } from "react";
import type { SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { Banner, Field, Mark, btnGhost, btnPrimary } from "../components/ui";

type Phase = "email" | "code" | "password";
const DRAFT_KEY = "nook-signup-draft";

function readDraft(): { email: string; phase: Phase; preview: string; delivery: string; verificationToken: string } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{ email: string; phase: Phase; preview: string; delivery: string; verificationToken: string }>;
    if ((parsed.phase !== "code" && parsed.phase !== "password") || typeof parsed.email !== "string" || !parsed.email) return null;
    return {
      email: parsed.email,
      phase: parsed.phase,
      preview: parsed.preview || "",
      delivery: parsed.delivery || "",
      verificationToken: parsed.verificationToken || "",
    };
  } catch {
    return null;
  }
}

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { login, meta, setSession } = useAuth();
  const navigate = useNavigate();
  const draft = mode === "signup" ? readDraft() : null;
  const [email, setEmail] = useState(draft?.email || "");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState(draft?.preview || "");
  const [delivery, setDelivery] = useState(draft?.delivery || "");
  const [verificationToken, setVerificationToken] = useState(draft?.verificationToken || "");
  const [phase, setPhase] = useState<Phase>(draft?.phase || "email");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "signup") return;
    if (phase === "email") {
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ email, phase, preview, delivery, verificationToken }));
  }, [mode, phase, email, preview, delivery, verificationToken]);

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
      setPhase("code");
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
      setPhase("password");
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
      sessionStorage.removeItem(DRAFT_KEY);
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
          <form className="space-y-4" method="get" action="/login" onSubmit={onLogin}>
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
        ) : phase === "email" ? (
          <form className="space-y-4" method="get" action="/signup" onSubmit={sendCode}>
            <Field label="Georgia Tech email">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@gatech.edu" required />
            </Field>
            <p className="text-sm text-muted">We'll send a 6-digit code before you can create a password.</p>
            <button className={btnPrimary} disabled={busy} type="submit">
              {busy ? "Sending…" : "Email me a code"}
            </button>

            <p className="text-sm text-muted">Already have an account? <Link to="/login" className="text-navy">Log in</Link></p>
          </form>
        ) : phase === "code" ? (
          <form className="space-y-4" method="get" action="/signup" onSubmit={verify}>
            {delivery === "preview" && preview ? (
              <Banner tone="note">
                Mail isn't configured, so the code that would have been emailed to {email} is <strong>{preview}</strong>. Add SMTP settings to send it for real.
              </Banner>
            ) : (
              <Banner tone="note">Check <strong>{email}</strong> for a 6-digit code. It expires in 15 minutes.</Banner>
            )}
            <Field label="Code">
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required />
            </Field>
            <button className={btnPrimary} disabled={busy} type="submit">
              Verify email
            </button>
            <button
              type="button"
              className="text-sm text-navy underline ml-3"
              onClick={() => {
                setPhase("email");
                setPreview("");
                setCode("");
                setVerificationToken("");
              }}
            >
              Use a different email
            </button>
          </form>
        ) : (
          <form className="space-y-4" method="get" action="/signup" onSubmit={register}>
            <p className="text-sm text-muted">Set a password with at least 8 characters, a letter, and a number.</p>
            <Field label="Georgia Tech email">
              <input type="email" name="username" autoComplete="username" value={email} readOnly />
            </Field>
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