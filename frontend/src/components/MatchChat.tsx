import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import type { ChatMessage } from "../types";
import { Banner, btnPrimary } from "./ui";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function MatchChat({
  bookingId,
  showInboxLink = true,
  onSeen,
  className = "mt-6",
}: {
  bookingId: string;
  showInboxLink?: boolean;
  onSeen?: () => void;
  className?: string;
}) {
  const { token } = useAuth();
  const onSeenRef = useRef(onSeen);
  useEffect(() => {
    onSeenRef.current = onSeen;
  }, [onSeen]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadMessages() {
    const body = await api<{ messages: ChatMessage[] }>(`/api/bookings/${bookingId}/messages`, {}, token);
    setMessages(body.messages);
  }

  useEffect(() => {
    let stop = false;
    loadMessages()
      .then(() => {
        if (!stop) onSeenRef.current?.();
      })
      .catch((err: unknown) => {
        if (!stop) setError(err instanceof ApiError ? err.message : "The thread didn't load.");
      });
    const id = window.setInterval(() => {
      if (document.hidden) return;
      loadMessages()
        .then(() => onSeenRef.current?.())
        .catch(() => undefined);
    }, 4000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [bookingId, token]);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    event.target.value = "";
    if (!next) return;
    if (next.size > 4 * 1024 * 1024) {
      setError("Photos need to be under 4 MB.");
      return;
    }
    if (next.type && !PHOTO_TYPES.includes(next.type)) {
      setError("Use a JPEG, PNG, GIF, or WebP photo.");
      return;
    }
    setError("");
    setFile(next);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body && !file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("channel", "nook");
      form.set("text", body);
      if (file) form.set("image", file);
      const saved = await api<{ message: ChatMessage }>(`/api/bookings/${bookingId}/messages`, { method: "POST", body: form }, token);
      setText("");
      setFile(null);
      setMessages((current) => [...current.filter((item) => item.id !== saved.message.id), saved.message]);
      onSeen?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That message didn't send.");
    } finally {
      setBusy(false);
    }
  }

  function replaceMessage(message: ChatMessage) {
    setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
  }

  async function react(messageId: string, emoji: string) {
    setError("");
    try {
      const saved = await api<{ message: ChatMessage }>(
        `/api/bookings/${bookingId}/messages/${messageId}/reactions`,
        { method: "POST", body: JSON.stringify({ emoji }) },
        token,
      );
      replaceMessage(saved.message);
      setPicker(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That reaction didn't stick.");
    }
  }

  async function saveEdit(message: ChatMessage) {
    const next = draft.trim();
    if (!next && !message.image_url) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api<{ message: ChatMessage }>(
        `/api/bookings/${bookingId}/messages/${message.id}`,
        { method: "PATCH", body: JSON.stringify({ text: next }) },
        token,
      );
      replaceMessage(saved.message);
      setEditingId(null);
      setDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That edit didn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(messageId: string) {
    setBusy(true);
    setError("");
    try {
      const saved = await api<{ message: ChatMessage }>(`/api/bookings/${bookingId}/messages/${messageId}`, { method: "DELETE" }, token);
      replaceMessage(saved.message);
      setConfirmDelete(null);
      if (editingId === messageId) setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That message didn't delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${className} rounded-[28px] border border-line bg-card p-5`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs tracking-[0.16em] text-gold uppercase">After you match</p>
          <h2 className="font-serif text-3xl text-navy">Message them here</h2>
        </div>
        {showInboxLink ? (
          <Link to={`/messages/${bookingId}`} className="text-sm text-navy underline">
            Open in Messages
          </Link>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">Only the two of you can see this thread. It stays in Nook.</p>
      {error ? (
        <div className="mt-3">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      <ol className="mt-4 max-h-96 space-y-3 overflow-auto">
        {messages.length === 0 ? <li className="text-sm text-muted">No messages yet. Say when you're heading over.</li> : null}
        {messages.map((message) => (
          <li key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.mine ? "bg-navy text-paper" : "bg-paper text-ink"}`}>
              {message.deleted ? (
                <p className="italic opacity-80">{message.mine ? "You deleted this message" : "This message was deleted"}</p>
              ) : (
                <>
                  {message.image_url ? <MessagePhoto url={message.image_url} token={token} /> : null}
                  {editingId === message.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} />
                      <div className="flex gap-2">
                        <button type="button" className="rounded-full bg-gold-soft px-3 py-1 text-xs font-medium text-navy" disabled={busy} onClick={() => void saveEdit(message)}>
                          Save
                        </button>
                        <button
                          type="button"
                          className="rounded-full px-3 py-1 text-xs underline"
                          onClick={() => {
                            setEditingId(null);
                            setDraft("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : message.text ? (
                    <p className={message.image_url ? "mt-2" : ""}>{message.text}</p>
                  ) : null}
                </>
              )}
              <p className={`mt-1 text-[11px] ${message.mine ? "text-gold-soft" : "text-muted"}`}>
                In Nook
                {message.edited_at && !message.deleted ? " · Edited" : ""}
              </p>
              {!message.deleted ? (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {message.reactions.map((reaction) => (
                    <button
                      key={reaction.emoji}
                      type="button"
                      className={`rounded-full border px-2 py-0.5 text-xs ${reaction.mine ? "border-gold bg-gold/20" : "border-line bg-white/70"}`}
                      onClick={() => void react(message.id, reaction.emoji)}
                    >
                      {reaction.emoji} {reaction.count}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rounded-full border border-line bg-white/70 px-2 py-0.5 text-xs text-ink"
                    aria-expanded={picker === message.id}
                    onClick={() => setPicker((current) => (current === message.id ? null : message.id))}
                  >
                    React
                  </button>
                  {message.mine ? (
                    <>
                      <button
                        type="button"
                        className="rounded-full px-2 py-0.5 text-xs underline"
                        onClick={() => {
                          setEditingId(message.id);
                          setDraft(message.text);
                          setConfirmDelete(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-full px-2 py-0.5 text-xs underline"
                        onClick={() => setConfirmDelete((current) => (current === message.id ? null : message.id))}
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
              {picker === message.id && !message.deleted ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {REACTIONS.map((emoji) => (
                    <button key={emoji} type="button" className="rounded-full bg-white px-2 py-1 text-base leading-none text-ink" aria-label={`React with ${emoji}`} onClick={() => void react(message.id, emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
              {confirmDelete === message.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span>Delete this message?</span>
                  <button type="button" className="rounded-full bg-clay px-2 py-1 text-white" disabled={busy} onClick={() => void remove(message.id)}>
                    Delete
                  </button>
                  <button type="button" className="underline" onClick={() => setConfirmDelete(null)}>
                    Keep
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <form className="mt-4 space-y-2" onSubmit={send}>
        {file ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-2">
            {preview ? <img src={preview} alt="Photo ready to send" className="h-14 w-14 rounded-xl object-cover" /> : null}
            <p className="min-w-0 flex-1 truncate text-sm">{file.name}</p>
            <button type="button" className="text-sm text-navy underline" onClick={() => setFile(null)}>
              Remove
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <button type="button" className="shrink-0 rounded-full border border-line bg-paper px-3 py-2 text-sm text-navy" aria-label="Add a photo" onClick={() => fileRef.current?.click()}>
            Photo
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={onFile} />
          <input className="min-w-0 flex-1" value={text} onChange={(event) => setText(event.target.value)} placeholder="Write in Nook" maxLength={1000} />
          <button className={`${btnPrimary} shrink-0`} disabled={busy || (!text.trim() && !file)} type="submit">
            {busy ? "Sending" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}

function MessagePhoto({ url, token }: { url: string; token: string | null }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let dead = false;
    let objectUrl = "";
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    fetch(url, { headers })
      .then((response) => {
        if (!response.ok) throw new Error("photo");
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!dead) setSrc(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      dead = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, token]);
  if (!src) return <p className="text-xs opacity-70">Loading photo…</p>;
  return <img src={src} alt="Photo in this thread" className="max-h-56 rounded-xl" />;
}
