import { useState } from "react";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { AboutForm } from "../components/AboutForm";
import type { AboutPayload } from "../components/AboutForm";
import { Shell } from "../components/Shell";
import { Banner, Tags } from "../components/ui";
import { VoiceInterview } from "../components/VoiceInterview";
import { placeLabel, sleepLabel, styleLabel } from "../format";

export function Profile() {
  const { token, user, refresh } = useAuth();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [redo, setRedo] = useState(false);

  async function save(payload: AboutPayload) {
    setError("");
    setNote("");
    try {
      await api("/api/me/questionnaire", { method: "POST", body: JSON.stringify(payload) }, token);
      await refresh();
      setNote("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    }
  }

  if (!user) return null;

  return (
    <Shell>
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Profile</p>
      <h1 className="font-serif text-4xl text-navy">{user.name || "Your profile"}</h1>
      <p className="mt-1 text-sm text-muted">
        {user.dorm_name ? `${placeLabel(user.dorm_name, user.unit)} · ${styleLabel(user.style)}` : "Off campus"} · {user.email}
      </p>
      <p className="mt-1 text-sm text-muted">
        {user.embedding_model === "muse-spark-1.3"
          ? "Your lifestyle vector came from Muse Spark 1.3."
          : "Your lifestyle vector is the on-device encoder. Add MODEL_API_KEY to extract it with Muse Spark."}
      </p>
      {user.bio ? <p className="mt-4 max-w-2xl leading-7">{user.bio}</p> : null}
      <div className="mt-3">
        <Tags tags={user.tags} />
      </div>
      <p className="mt-3 text-sm text-muted">
        {sleepLabel(user.sleep_timing)}
        {user.cleanliness ? ` · ${user.cleanliness}` : ""}
      </p>
      {error ? (
        <div className="mt-4">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      {note ? (
        <div className="mt-4">
          <Banner tone="note">{note}</Banner>
        </div>
      ) : null}
      <div className="mt-8">
        <h2 className="font-serif text-2xl">Edit the questionnaire</h2>
        <div className="mt-4">
          <AboutForm key={user.id + user.major + user.hometown} initial={user} submitLabel="Save profile" onSubmit={save} />
        </div>
      </div>
      <div className="mt-10 max-w-2xl">
        <button type="button" className="text-sm text-navy underline" onClick={() => setRedo((value) => !value)}>
          {redo ? "Close the interview" : "Redo the interview"}
        </button>
        {redo ? (
          <div className="mt-4">
            <VoiceInterview
              onDone={() => {
                setRedo(false);
                setNote("Interview saved. Your bio and match vector were rebuilt.");
              }}
            />
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
