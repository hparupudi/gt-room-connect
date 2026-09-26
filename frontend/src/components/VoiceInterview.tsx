import { useEffect, useRef, useState } from "react";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import type { User } from "../types";
import { Banner, Field, btnGhost, btnPrimary } from "./ui";

const NOISE = [
  { id: "quiet", label: "Quiet" },
  { id: "moderate", label: "Moderate" },
  { id: "social", label: "Social" },
];

export function VoiceInterview({ onDone }: { onDone: (user: User) => void }) {
  const { token, meta, refresh } = useAuth();
  const questions = meta?.questions ?? [];
  const [mode, setMode] = useState<"ask" | "form">("ask");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [micNote, setMicNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array.from({ length: 24 }, () => 8));
  const [interests, setInterests] = useState("");
  const [cleanliness, setCleanliness] = useState("");
  const [sleepTiming, setSleepTiming] = useState("");
  const [noise, setNoise] = useState("");
  const [guestNotes, setGuestNotes] = useState("");

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const recognition = useRef<{ stop: () => void } | null>(null);
  const interimRef = useRef("");
  const answersRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const elapsed = useRef(0);
  const startedAt = useRef<number | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    setAnswers((current) => {
      if (current.length === questions.length) return current;
      const next = questions.map((_, item) => current[item] ?? "");
      answersRef.current = next;
      return next;
    });
  }, [questions]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  function stopCapture() {
    recognition.current?.stop();
    recognition.current = null;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void audioContext.current?.close();
    audioContext.current = null;
    if (startedAt.current != null) {
      elapsed.current += (Date.now() - startedAt.current) / 1000;
      startedAt.current = null;
    }
  }

  useEffect(() => {
    return () => stopCapture();
  }, []);

  function writeAnswer(value: string, at = indexRef.current) {
    const next = answersRef.current.slice();
    while (next.length <= at) next.push("");
    next[at] = value;
    answersRef.current = next;
    setAnswers(next);
  }

  function flushInterim() {
    const extra = interimRef.current.trim();
    interimRef.current = "";
    if (!extra) return answersRef.current[indexRef.current] ?? "";
    const current = answersRef.current[indexRef.current] ?? "";
    if (current.toLowerCase().includes(extra.toLowerCase())) return current;
    const merged = `${current} ${extra}`.replace(/\s+/g, " ").trim();
    writeAnswer(merged);
    return merged;
  }

  async function start() {
    setError("");
    interimRef.current = "";
    setRunning(true);
    startedAt.current = Date.now();
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const context = new AudioContext();
      audioContext.current = context;
      const source = context.createMediaStreamSource(media);
      const analyser = context.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const paint = () => {
        if (!stream.current) return;
        analyser.getByteFrequencyData(data);
        setLevels(Array.from(data.slice(0, 24), (value) => 8 + value / 7));
        requestAnimationFrame(paint);
      };
      paint();
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      rec.start();
      setMicNote("");
    } catch {
      setMicNote("The mic isn't available. Type this answer, or switch to the habit form.");
      setRunning(false);
      if (startedAt.current != null) {
        elapsed.current += (Date.now() - startedAt.current) / 1000;
        startedAt.current = null;
      }
    }

    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech || !stream.current) return;
    const heard = new Speech();
    heard.continuous = true;
    heard.interimResults = true;
    heard.onresult = (event: { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> }) => {
      let finalText = "";
      let interim = "";
      for (let cursor = event.resultIndex; cursor < event.results.length; cursor += 1) {
        const piece = event.results[cursor][0].transcript;
        if (event.results[cursor].isFinal) finalText += `${piece} `;
        else interim += piece;
      }
      interimRef.current = interim.trim();
      if (finalText) {
        const current = answersRef.current[indexRef.current] ?? "";
        writeAnswer(`${current} ${finalText}`.replace(/\s+/g, " ").trim());
      }
    };
    try {
      heard.start();
      recognition.current = heard;
    } catch {
      /* recognition can fail independently of the mic */
    }
  }

  async function stopTalking() {
    setRunning(false);
    recognition.current?.stop();
    recognition.current = null;
    if (recorder.current && recorder.current.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.current!.onstop = () => resolve();
        recorder.current!.stop();
      });
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void audioContext.current?.close();
    audioContext.current = null;
    if (startedAt.current != null) {
      elapsed.current += (Date.now() - startedAt.current) / 1000;
      startedAt.current = null;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    flushInterim();
  }

  async function checkAnswer(at: number, answer: string) {
    await api("/api/me/interview/answer", { method: "POST", body: JSON.stringify({ index: at, answer }) }, token);
  }

  async function goNext() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      if (running) await stopTalking();
      else flushInterim();
      const answer = (answersRef.current[index] ?? "").trim();
      await checkAnswer(index, answer);
      if (index < questions.length - 1) {
        setIndex((current) => current + 1);
        return;
      }
      const transcript = answersRef.current.map((item) => item.trim()).filter(Boolean).join(" ");
      const body = new FormData();
      const live = startedAt.current != null ? (Date.now() - startedAt.current) / 1000 : 0;
      body.set("duration_sec", String(Math.max(0, elapsed.current + live)));
      body.set("transcript", transcript);
      if (chunks.current.length && !transcript) {
        body.set("audio", new Blob(chunks.current, { type: "audio/webm" }), "interview.webm");
      }
      const result = await api<{ user: User }>("/api/me/interview", { method: "POST", body }, token);
      await refresh();
      onDone(result.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That answer needs a little more.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function goBack() {
    setError("");
    if (running) await stopTalking();
    setIndex((current) => Math.max(0, current - 1));
  }

  async function saveForm() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: User }>(
        "/api/me/interview/direct",
        {
          method: "POST",
          body: JSON.stringify({
            interests,
            cleanliness,
            sleep_timing: sleepTiming,
            noise,
            guest_notes: guestNotes,
          }),
        },
        token,
      );
      await refresh();
      onDone(result.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Those habits didn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function switchMode() {
    setError("");
    if (running) await stopTalking();
    setMode((current) => (current === "ask" ? "form" : "ask"));
  }

  const question = questions[index] ?? "";
  const last = questions.length > 0 && index === questions.length - 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">
          {mode === "ask"
            ? "One question at a time. Talk for as long as you want, then continue when the answer covers it."
            : "Enter your habits directly. Nook builds the same profile from these fields."}
        </p>
        <button type="button" className="text-sm text-navy underline" onClick={() => void switchMode()}>
          {mode === "ask" ? "Type your habits instead" : "Answer out loud instead"}
        </button>
      </div>

      {mode === "form" ? (
        <div className="space-y-4">
          <Field label="What are you into">
            <textarea rows={3} value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Clubs, hobbies, and a Friday night that sounds like you" />
          </Field>
          <Field label="How clean you keep a shared room">
            <select value={cleanliness} onChange={(event) => setCleanliness(event.target.value)}>
              <option value="">Choose one</option>
              {(meta?.cleanliness ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="When you usually fall asleep">
            <select value={sleepTiming} onChange={(event) => setSleepTiming(event.target.value)}>
              <option value="">Choose one</option>
              {(meta?.sleep ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.hint ? ` · ${item.hint}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Noise and guests">
            <select value={noise} onChange={(event) => setNoise(event.target.value)}>
              <option value="">Choose one</option>
              {NOISE.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="What a weekend guest should know">
            <textarea rows={3} value={guestNotes} onChange={(event) => setGuestNotes(event.target.value)} placeholder="Text first, shoes off, quiet after midnight…" />
          </Field>
          {error ? <Banner>{error}</Banner> : null}
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void saveForm()}>
            {busy ? "Writing your profile…" : "Save habits"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs tracking-[0.16em] text-gold uppercase">
            Question {questions.length ? index + 1 : 0} of {questions.length}
          </p>
          <h2 className="font-serif text-3xl text-navy">{question}</h2>
          <div className="rounded-[28px] border border-line bg-navy px-5 py-6 text-paper">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gold-soft">{running ? "Listening. Keep going until this answer feels done." : "Start when you're ready. There is no time limit."}</p>
              {running ? (
                <button type="button" className="rounded-full bg-gold-soft px-4 py-2 text-sm font-medium text-navy" onClick={() => void stopTalking()}>
                  Stop talking
                </button>
              ) : (
                <button type="button" className="rounded-full bg-gold-soft px-4 py-2 text-sm font-medium text-navy" onClick={() => void start()}>
                  Start talking
                </button>
              )}
            </div>
            <div className="mt-4 flex h-12 items-end gap-1" aria-hidden="true">
              {levels.map((level, bar) => (
                <span key={bar} className="w-full rounded-full bg-gold-soft/80" style={{ height: running ? `${Math.min(level, 48)}px` : "8px" }} />
              ))}
            </div>
          </div>
          {micNote ? <Banner tone="note">{micNote}</Banner> : null}
          <Field label="Your answer">
            <textarea
              rows={4}
              value={answers[index] ?? ""}
              onChange={(event) => writeAnswer(event.target.value)}
              placeholder="Speak, or type this answer."
            />
          </Field>
          {error ? <Banner>{error}</Banner> : null}
          <div className="flex gap-2">
            <button type="button" className={btnGhost} disabled={index === 0 || busy} onClick={() => void goBack()}>
              Back
            </button>
            <button type="button" className={btnPrimary} disabled={busy || questions.length === 0} onClick={() => void goNext()}>
              {busy ? "Checking…" : last ? "Save interview" : "Next"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  }
}

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
};
