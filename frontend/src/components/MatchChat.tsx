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
  const [typers, setTypers] = useState<{ id: string; name: string }[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const textRef = useRef(text);
  const focusedRef = useRef(false);
  const typingSent = useRef(false);
  textRef.current = text;

  function signalTyping(active: boolean) {
    typingSent.current = active;
    void api(`/api/bookings/${bookingId}/typing`, { method: "POST", body: JSON.stringify({ active }) }, token).catch(() => undefined);
  }

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
    let stop = false;
    async function pollTyping() {
      try {
        const body = await api<{ typing: { id: string; name: string }[] }>(`/api/bookings/${bookingId}/typing`, {}, token);
        if (!stop) setTypers(body.typing);
      } catch {
        /* the message poll reports a dead thread */
      }
    }
    void pollTyping();
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void pollTyping();
    }, 1200);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [bookingId, token]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const active = focusedRef.current && textRef.current.trim().length > 0;
      if (!active && !typingSent.current) return;
      typingSent.current = active;
      void api(`/api/bookings/${bookingId}/typing`, { method: "POST", body: JSON.stringify({ active }) }, token).catch(() => undefined);
    }, 2000);
    return () => {
      window.clearInterval(id);
      if (typingSent.current) {
        typingSent.current = false;
        void api(`/api/bookings/${bookingId}/typing`, { method: "POST", body: JSON.stringify({ active: false }) }, token).catch(() => undefined);
      }
    };
  }, [bookingId, token]);

  useEffect(() => {
    if (!menu) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (target.closest("[data-message-actions]")) return;
      setMenu(null);
      setConfirmDelete(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu(null);
        setConfirmDelete(false);
      }
    }
    function close() {
      setMenu(null);
      setConfirmDelete(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

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
      form.set("channel", "dormsurf");
      form.set("text", body);
      if (file) form.set("image", file);
      const saved = await api<{ message: ChatMessage }>(`/api/bookings/${bookingId}/messages`, { method: "POST", body: form }, token);
      setText("");
      setFile(null);
      if (typingSent.current) signalTyping(false);
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
      setMenu(null);
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

  function openMenu(id: string, anchor: HTMLElement, mine: boolean) {
    if (menu?.id === id) {
      setMenu(null);
      setConfirmDelete(false);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const width = 232;
    let left = mine ? rect.right - width : rect.left;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 190 ? rect.bottom + 8 : Math.max(12, rect.top - 176);
    setConfirmDelete(false);
    setMenu({ id, top, left });
  }

  async function remove(messageId: string) {
    setBusy(true);
    setError("");
    try {
      const saved = await api<{ message: ChatMessage }>(`/api/bookings/${bookingId}/messages/${messageId}`, { method: "DELETE" }, token);
      replaceMessage(saved.message);
      setConfirmDelete(false);
      setMenu(null);
      if (editingId === messageId) setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That message didn't delete.");
    } finally {
      setBusy(false);
    }
  }

  const menuMessage = messages.find((item) => item.id === menu?.id) ?? null;

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
      <p className="mt-1 text-sm text-muted">Only the two of you can see this thread. Double-click a message, or the menu beside it, to react, edit, or delete.</p>
      {error ? (
        <div className="mt-3">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      <ol className="mt-4 max-h-96 space-y-3 overflow-auto">
        {messages.length === 0 ? <li className="text-sm text-muted">No messages yet. Say when you're heading over.</li> : null}
        {messages.map((message) => (
          <li key={message.id} className={`flex items-start gap-1 ${message.mine ? "flex-row-reverse" : ""}`}>
            <div className="max-w-[85%]">
              <div
                data-message-bubble
                className={`rounded-2xl px-3 py-2 text-sm ${message.mine ? "bg-navy text-paper" : "bg-paper text-ink"}`}
                onDoubleClick={(event) => {
                  if (message.deleted || editingId === message.id) return;
                  openMenu(message.id, event.currentTarget, message.mine);
                }}
              >
                {message.deleted ? (
                  <p className="italic opacity-80">{message.mine ? "You deleted this message" : "This message was deleted"}</p>
                ) : (
                  <>
                    {message.image_url ? <MessagePhoto url={message.image_url} token={token} /> : null}
                    {editingId === message.id ? (
                      <div className="space-y-2">
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
                  In Dormsurf
                  {message.edited_at && !message.deleted ? " · Edited" : ""}
                </p>
              </div>
              {!message.deleted && message.reactions.length > 0 ? (
                <div className={`mt-1 flex flex-wrap gap-1 ${message.mine ? "justify-end" : ""}`}>
                  {message.reactions.map((reaction) => (
                    <button
                      key={reaction.emoji}
                      type="button"
                      className={`rounded-full border px-2 py-0.5 text-xs ${reaction.mine ? "border-gold bg-gold/15" : "border-line bg-white"}`}
                      onClick={() => void react(message.id, reaction.emoji)}
                    >
                      {reaction.emoji} {reaction.count}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {!message.deleted && editingId !== message.id ? (
              <button
                type="button"
                data-message-actions
                className={`mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-paper hover:text-navy ${menu?.id === message.id ? "bg-paper text-navy" : ""}`}
                aria-label="Message actions"
                aria-haspopup="menu"
                aria-expanded={menu?.id === message.id}
                onClick={(event) => {
                  const bubble = event.currentTarget.parentElement?.querySelector("[data-message-bubble]");
                  openMenu(message.id, (bubble as HTMLElement) || event.currentTarget, message.mine);
                }}
              >
                <Dots />
              </button>
            ) : (
              <span className="w-7 shrink-0" />
            )}
          </li>
        ))}
        {typers.map((person) => (
          <li key={person.id} data-typing-indicator={person.name} className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-paper px-3 py-2 text-sm text-ink">
              <p>{person.name} is typing</p>
              <span className="typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          </li>
        ))}
      </ol>
      {menuMessage ? (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 w-[232px] rounded-2xl border border-line bg-card p-2 shadow-[0_12px_40px_rgba(28,36,48,0.16)]"
          style={{ top: menu?.top, left: menu?.left }}
        >
          <p className="px-2 pt-1 text-[11px] tracking-[0.14em] text-gold uppercase">React</p>
          <div className="mt-1 flex justify-between px-1">
            {REACTIONS.map((emoji) => {
              const mine = menuMessage.reactions.some((reaction) => reaction.emoji === emoji && reaction.mine);
              return (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  className={`grid h-8 w-8 place-items-center rounded-full text-base leading-none hover:bg-paper ${mine ? "bg-gold/20 ring-1 ring-gold" : ""}`}
                  aria-label={`React with ${emoji}`}
                  onClick={() => void react(menuMessage.id, emoji)}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
          {menuMessage.mine ? (
            <div className="mt-1 border-t border-line pt-1">
              {confirmDelete ? (
                <div className="px-2 py-2">
                  <p className="text-sm">Delete this message?</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="rounded-full bg-clay px-3 py-1 text-xs text-white" disabled={busy} onClick={() => void remove(menuMessage.id)}>
                      Delete
                    </button>
                    <button type="button" className="rounded-full px-3 py-1 text-xs text-navy underline" onClick={() => setConfirmDelete(false)}>
                      Keep
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-paper"
                    onClick={() => {
                      setEditingId(menuMessage.id);
                      setDraft(menuMessage.text);
                      setMenu(null);
                      setConfirmDelete(false);
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" role="menuitem" className="block w-full rounded-xl px-3 py-2 text-left text-sm text-clay hover:bg-paper" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
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
          <input
            className="min-w-0 flex-1"
            value={text}
            placeholder="Write in Dormsurf"
            maxLength={1000}
            onFocus={() => {
              focusedRef.current = true;
              if (textRef.current.trim()) signalTyping(true);
            }}
            onBlur={() => {
              focusedRef.current = false;
              if (typingSent.current) signalTyping(false);
            }}
            onChange={(event) => {
              const next = event.target.value;
              setText(next);
              const active = focusedRef.current && next.trim().length > 0;
              if (active !== typingSent.current) signalTyping(active);
            }}
          />
          <button className={`${btnPrimary} shrink-0`} disabled={busy || (!text.trim() && !file)} type="submit">
            {busy ? "Sending" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Dots() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="3.2" r="1.25" fill="currentColor" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
      <circle cx="8" cy="12.8" r="1.25" fill="currentColor" />
    </svg>
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
