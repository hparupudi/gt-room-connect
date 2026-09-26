import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { AboutForm } from "../components/AboutForm";
import type { AboutPayload } from "../components/AboutForm";
import { DatePicker } from "../components/DatePicker";
import { DormBrowser } from "../components/DormBrowser";
import { Banner, Mark, btnPrimary } from "../components/ui";
import { VoiceInterview } from "../components/VoiceInterview";
import { useDates } from "../dates";
import { formatDates } from "../format";

const NO_DATES: string[] = [];

const STEPS = [
  { id: "room", label: "Your room" },
  { id: "about", label: "About you" },
  { id: "voice", label: "Voice" },
] as const;

export function Onboarding() {
  const { token, user, refresh } = useAuth();
  const { dates } = useDates();
  const navigate = useNavigate();
  const [step, setStep] = useState<(typeof STEPS)[number]["id"]>(user?.onboarding_step === "done" ? "voice" : user?.onboarding_step || "room");
  const [pick, setPick] = useState<{ dormId: string; dormName: string; floor: number; unit: string } | null>(
    user?.dorm_id ? { dormId: user.dorm_id, dormName: user.dorm_name || user.dorm_id, floor: user.floor || 1, unit: user.unit } : null,
  );
  const [offer, setOffer] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const roomDates = useMemo(() => (offer ? dates : NO_DATES), [offer, dates]);

  async function saveRoom() {
    if (!pick) return;
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
      setStep("about");
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
      setStep("voice");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Mark />
        <span className="font-serif text-2xl">Nook</span>
      </div>
      <p className="text-xs tracking-[0.16em] text-gold uppercase">First time in</p>
      <h1 className="font-serif text-4xl text-navy">Claim a room, then tell us how you live.</h1>
      <ol className="mt-4 flex flex-wrap gap-2">
        {STEPS.map((item, index) => (
          <li key={item.id} className={`rounded-full px-3 py-1 text-sm ${step === item.id ? "bg-navy text-paper" : "bg-card text-muted"}`}>
            {index + 1}. {item.label}
          </li>
        ))}
      </ol>
      {error ? (
        <div className="mt-4">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      {step === "room" ? (
        <div className="mt-6 space-y-4">
          <DormBrowser
            dates={roomDates}
            mode="pick"
            pickedUnit={pick?.unit}
            onPick={setPick}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={offer} onChange={(event) => setOffer(event.target.checked)} />
            My couch is free on the dates below. You can change this later.
          </label>
          {offer ? <DatePicker /> : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btnPrimary} disabled={!pick || busy} onClick={saveRoom}>
              {pick ? `This is my room · ${pick.dormName} ${pick.unit}` : "Select a unit"}
            </button>
            {offer && dates.length === 0 ? <p className="text-sm text-clay">Pick at least one night or uncheck the offer.</p> : null}
            {offer && dates.length ? <p className="text-sm text-muted">{formatDates(dates)}</p> : null}
          </div>
        </div>
      ) : null}
      {step === "about" ? (
        <div className="mt-6">
          <AboutForm initial={user ?? undefined} submitLabel="Continue to the interview" onSubmit={saveAbout} />
        </div>
      ) : null}
      {step === "voice" ? (
        <div className="mt-6 max-w-2xl">
          <VoiceInterview onDone={() => navigate("/discover")} />
        </div>
      ) : null}
    </div>
  );
}
