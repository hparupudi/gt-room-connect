import { useEffect, useRef, useState } from "react";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import type { User } from "../types";
import { Banner, btnPrimary } from "./ui";

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
  const transcriptRef = useRef("");
  const interimRef = useRef("");
  const saving = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  function writeTranscript(value: string) {
    const next = value.replace(/\s+/g, " ").trim();
    transcriptRef.current = next;
    setTranscript(next);
  }

  function stopCapture() {
    recognition.current?.stop();
    recognition.current = null;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  useEffect(() => {
    return () => stopCapture();
  }, []);

  async function start() {
    setError("");
    setSeconds(0);
    chunks.current = [];
    interimRef.current = "";
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
      setMicNote("The mic isn't available, so type your answers. That's enough for the profile if you cover your habits.");
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
        interimRef.current = interim.trim();
        if (finalText) writeTranscript(`${transcriptRef.current} ${finalText}`);
      };
      try {
        heard.start();
        recognition.current = heard;
      } catch {
        /* recognition can fail independently of the mic */
      }
    }
  }

  function flushInterim() {
    const extra = interimRef.current.trim();
    interimRef.current = "";
    if (!extra) return;
    if (transcriptRef.current.toLowerCase().includes(extra.toLowerCase())) return;
    writeTranscript(`${transcriptRef.current} ${extra}`);
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
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      flushInterim();
      const body = new FormData();
      body.set("duration_sec", String(seconds));
      body.set("transcript", transcriptRef.current.trim());
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

  async function finishAndSave() {
    if (saving.current) return;
    saving.current = true;
    setRunning(false);
    recognition.current?.stop();
    recognition.current = null;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    flushInterim();
    try {
      await submit();
    } finally {
      saving.current = false;
    }
  }

  const activeQuestion = questions.length ? Math.min(questions.length - 1, Math.floor(seconds / 12)) : 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Cover each prompt, then stop. A short take is fine. Nook only rejects the recording when a habit is still missing.
      </p>
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
              <span className="text-2xl text-gold-soft">s</span>
            </p>
          </div>
          {!running && seconds === 0 ? (
            <button type="button" className="rounded-full bg-gold-soft px-4 py-2 text-sm font-medium text-navy" onClick={start}>
              Start recording
            </button>
          ) : running ? (
            <button type="button" className="rounded-full bg-gold-soft px-4 py-2 text-sm font-medium text-navy" disabled={busy} onClick={finishAndSave}>
              {busy ? "Saving…" : "I'm done"}
            </button>
          ) : null}
        </div>
        <div className="mt-4 flex h-12 items-end gap-1" aria-hidden="true">
          {levels.map((level, index) => (
            <span key={index} className="w-full rounded-full bg-gold-soft/80" style={{ height: `${Math.min(level, 48)}px` }} />
          ))}
        </div>
        <p className="mt-3 text-sm text-gold-soft">
          {running
            ? "Stop whenever you've covered your habits. You don't have to fill a minute."
            : seconds === 0
              ? "Hit start, talk through the prompts, then stop when you're finished."
              : "Recording stopped. Save it, or edit the transcript if something got missed."}
        </p>
      </div>
      {micNote ? <Banner tone="note">{micNote}</Banner> : null}
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Transcript</span>
        <textarea
          rows={5}
          value={transcript}
          onChange={(event) => writeTranscript(event.target.value)}
          placeholder="The mic fills this in. Edit anything it missed, including habits you didn't say out loud."
        />
      </label>
      {error ? <Banner>{error}</Banner> : null}
      <button type="button" className={btnPrimary} disabled={busy} onClick={running ? finishAndSave : submit}>
        {busy ? "Writing your profile…" : running ? "Stop and save" : "Save interview"}
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
