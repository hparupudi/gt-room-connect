import { useEffect, useRef, useState } from "react";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import type { User } from "../types";
import { Banner, btnPrimary } from "./ui";

const MIN_SECONDS = 30;
const MAX_SECONDS = 60;

export function VoiceInterview({ onDone }: { onDone: (user: User) => void }) {
  const { token, meta, refresh } = useAuth();
  const questions = meta?.questions ?? [];
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [micNote, setMicNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array.from({ length: 24 }, () => 8));
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const recognition = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSeconds((current) => {
        if (current + 1 >= MAX_SECONDS) {
          setRunning(false);
          return MAX_SECONDS;
        }
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running) stopCapture();
  }, [running]);

  function stopCapture() {
    recognition.current?.stop();
    recognition.current = null;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  async function start() {
    setError("");
    setSeconds(0);
    chunks.current = [];
    setRunning(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(media);
      const analyser = audioContext.createAnalyser();
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
      setMicNote("The mic isn't available, so type your answers while the timer runs. That's enough for the profile.");
    }

    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Speech) {
      const heard = new Speech();
      heard.continuous = true;
      heard.interimResults = true;
      heard.onresult = (event: { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> }) => {
        let finalText = "";
        let interim = "";
        for (let index = 0; index < event.results.length; index += 1) {
          const piece = event.results[index][0].transcript;
          if (event.results[index].isFinal) finalText += `${piece} `;
          else interim += piece;
        }
        if (finalText) {
          setTranscript((current) => `${current} ${finalText}`.replace(/\s+/g, " ").trim());
        } else if (interim) {
          setTranscript((current) => current || interim);
        }
      };
      try {
        heard.start();
        recognition.current = heard;
      } catch {
        /* recognition can fail independently of the mic */
      }
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (recorder.current && recorder.current.state !== "inactive") {
        await new Promise<void>((resolve) => {
          recorder.current!.onstop = () => resolve();
          recorder.current!.stop();
        });
      }
      const body = new FormData();
      body.set("duration_sec", String(seconds));
      body.set("transcript", transcript.trim());
      if (chunks.current.length) {
        body.set("audio", new Blob(chunks.current, { type: "audio/webm" }), "interview.webm");
      }
      const result = await api<{ user: User }>("/api/me/interview", { method: "POST", body }, token);
      await refresh();
      onDone(result.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The interview didn't save.");
    } finally {
      setBusy(false);
    }
  }

  const activeQuestion = Math.min(questions.length - 1, Math.floor(seconds / 15));

  return (
    <div className="space-y-5">
      <ol className="space-y-2">
        {questions.map((question, index) => (
          <li
            key={question}
            className={`rounded-2xl border px-4 py-3 text-sm ${
              running && index === activeQuestion ? "border-navy bg-white" : "border-line bg-card"
            }`}
          >
            <span className="mr-2 font-serif text-gold">{index + 1}</span>
            {question}
          </li>
        ))}
      </ol>
      <div className="rounded-[28px] border border-line bg-navy px-5 py-6 text-paper">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.16em] text-gold-soft uppercase">One take</p>
            <p className="font-serif text-5xl tabular-nums">
              {seconds}
              <span className="text-2xl text-gold-soft"> / {MAX_SECONDS}s</span>
            </p>
          </div>
          {!running && seconds === 0 ? (
            <button type="button" className="rounded-full bg-gold-soft px-4 py-2 text-sm font-medium text-navy" onClick={start}>
              Start recording
            </button>
          ) : running ? (
            <button type="button" className="rounded-full bg-white/10 px-4 py-2 text-sm" onClick={() => setRunning(false)}>
              Stop
            </button>
          ) : null}
        </div>
        <div className="mt-4 flex h-12 items-end gap-1" aria-hidden="true">
          {levels.map((level, index) => (
            <span key={index} className="w-full rounded-full bg-gold-soft/80" style={{ height: `${Math.min(level, 48)}px` }} />
          ))}
        </div>
        <p className="mt-3 text-sm text-gold-soft">
          {seconds < MIN_SECONDS
            ? `Keep going until ${MIN_SECONDS} seconds so the profile has a real voice to it.`
            : "That's enough. Stop anytime before a minute, or let it finish."}
        </p>
      </div>
      {micNote ? <Banner tone="note">{micNote}</Banner> : null}
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Transcript</span>
        <textarea
          rows={5}
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder="The mic fills this in. Edit anything it missed."
        />
      </label>
      {error ? <Banner>{error}</Banner> : null}
      <button
        type="button"
        className={btnPrimary}
        disabled={busy || seconds < MIN_SECONDS || transcript.trim().length < 40}
        onClick={submit}
      >
        {busy ? "Writing your profile…" : "Save interview"}
      </button>
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
