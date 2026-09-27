import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { AboutForm } from "../components/AboutForm";
import type { AboutPayload } from "../components/AboutForm";
import { DatePicker } from "../components/DatePicker";
import { DormBrowser } from "../components/DormBrowser";
import { Banner, Mark, btnGhost, btnPrimary } from "../components/ui";
import { VoiceInterview } from "../components/VoiceInterview";
import { useDates } from "../dates";
import { formatDates } from "../format";

const NO_DATES: string[] = [];

const STEPS = [
  { id: "room", label: "Your room", title: "Where do you live?" },
  { id: "about", label: "About you", title: "Let's build your profile" },
  { id: "voice", label: "Voice", title: "Your preferences" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function reachedIndex(step: string | undefined): number {
  if (step === "about") return 1;
  if (step === "voice" || step === "done") return 2;
  return 0;
}

export function Onboarding() {
  const { token, user, refresh, logout } = useAuth();
  const { dates } = useDates();
  const navigate = useNavigate();
  const [step, setStep] = useState<StepId>(user?.onboarding_step === "done" ? "voice" : user?.onboarding_step === "about" || user?.onboarding_step === "voice" ? user.onboarding_step : "room");
  const [reached, setReached] = useState(() => reachedIndex(user?.onboarding_step));
  const [pick, setPick] = useState<{ dormId: string; dormName: string; floor: number; unit: string } | null>(
    user?.dorm_id ? { dormId: user.dorm_id, dormName: user.dorm_name || user.dorm_id, floor: user.floor || 1, unit: user.unit } : null,
  );
  const [offer, setOffer] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const roomDates = useMemo(() => (offer ? dates : NO_DATES), [offer, dates]);
  const index = STEPS.findIndex((item) => item.id === step);

  function goTo(target: StepId) {
    if (STEPS.findIndex((item) => item.id === target) > reached) return;
    setError("");
    setStep(target);
  }

  async function skipRoom() {
    if (user?.room_skipped && !user.dorm_id && reached > 0) {
      setStep("about");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/api/me/room", { method: "POST", body: JSON.stringify({ skip: true }) }, token);
      await refresh();
      setPick(null);
      setOffer(false);
      setReached((current) => Math.max(current, 1));
      setStep("about");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't skip the room.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRoom(advance: boolean) {
    if (!pick) {
      if (advance) await skipRoom();
      return;
    }
    const unchanged =
      user?.dorm_id === pick.dormId && user.unit === pick.unit && user.floor === pick.floor && reached > 0 && !offer;
    if (unchanged) {
      if (advance) setStep("about");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(
        "/api/me/room",
        {
          method: "POST",
          body: JSON.stringify({
            dorm_id: pick.dormId,
            floor: pick.floor,
            unit: pick.unit,
            open_dates: offer ? dates : [],
          }),
        },
        token,
      );
      await refresh();
      setReached((current) => Math.max(current, 1));
      if (advance) setStep("about");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the room.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAbout(payload: AboutPayload) {
    setError("");
    try {
      await api("/api/me/questionnaire", { method: "POST", body: JSON.stringify(payload) }, token);
      await refresh();
      setReached((current) => Math.max(current, 2));
      setStep("voice");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that.");
    }
  }

  function next() {
    if (step === "room") {
      void saveRoom(true);
      return;
    }
    if (step === "about") {
      const form = document.getElementById("about-form");
      if (form instanceof HTMLFormElement) form.requestSubmit();
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Mark />
          <span className="font-serif text-2xl">Dormsurf</span>
        </div>
        <button type="button" onClick={logout} className="text-sm text-muted hover:text-ink">
          Log out
        </button>
      </div>
<<<<<<< HEAD
      <p className="text-xs tracking-[0.16em] text-gold uppercase">First time in</p>
      <h1 className="font-serif text-4xl text-navy">Tell us where you live, then how you live.</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        A Georgia Tech room is optional. Off-campus Yellow Jackets and students from other schools can skip it and still request a bed.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
=======
      <div className="flex flex-wrap items-center justify-between gap-3">
>>>>>>> 2d40b8bff9dca56b6de840400c369c5bff886f4e
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((item, itemIndex) => {
            const open = itemIndex <= reached;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!open}
                  onClick={() => goTo(item.id)}
                  className={`rounded-full px-3 py-1 text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${
                    step === item.id ? "bg-navy text-paper" : "bg-card text-muted"
                  }`}
                >
                  {itemIndex + 1}. {item.label}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} disabled={index === 0} onClick={() => goTo(STEPS[index - 1].id)}>
            Back
          </button>
          <button type="button" className={btnPrimary} disabled={step === "voice" || busy} onClick={next}>
            Next
          </button>
        </div>
      </div>
      <h1 className="font-serif text-4xl text-navy mt-4">{STEPS[index].title}</h1>
      {error ? (
        <div className="mt-4">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      <div className={step === "room" ? "mt-6 space-y-4" : "hidden"}>
          <DormBrowser
            dates={roomDates}
            mode="pick"
            pickedUnit={pick?.unit}
            onPick={setPick}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={offer} onChange={(event) => setOffer(event.target.checked)} />
            My bed is free on the dates below. A shared room stays hidden until your roommate agrees.
          </label>
          {offer ? <DatePicker /> : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btnPrimary} disabled={!pick || busy} onClick={() => void saveRoom(true)}>
              {pick ? `This is my room · ${pick.dormName} ${pick.unit}` : "Select a unit"}
            </button>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => void skipRoom()}>
              I live off campus
            </button>
            {offer && dates.length === 0 ? <p className="text-sm text-clay">Pick at least one night or uncheck the offer.</p> : null}
            {offer && dates.length ? <p className="text-sm text-muted">{formatDates(dates)}</p> : null}
          </div>
      </div>
      <div className={step === "about" ? "mt-6" : "hidden"}>
        <AboutForm initial={user ?? undefined} submitLabel="Continue to the interview" onSubmit={saveAbout} />
      </div>
      <div className={step === "voice" ? "mt-6 max-w-2xl" : "hidden"}>
        <VoiceInterview onDone={() => navigate("/discover")} />
      </div>
    </div>
  );
}
