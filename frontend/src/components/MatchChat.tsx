import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import type { ChatMessage, MessagingStatus } from "../types";
import { Banner, btnPrimary } from "./ui";

const CHANNELS = [
  { id: "nook", label: "In Nook" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
] as const;

export function MatchChat({ bookingId }: { bookingId: string }) {
  const { token, meta } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<MessagingStatus | null>(null);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["id"]>("nook");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadMessages() {
    const body = await api<{ messages: ChatMessage[] }>(`/api/bookings/${bookingId}/messages`, {}, token);
    setMessages(body.messages);
  }

  async function loadStatus() {
    const body = await api<MessagingStatus>("/api/me/messaging", {}, token);
    setStatus(body);
  }

  useEffect(() => {
    let stop = false;
    loadMessages().catch((err: unknown) => {
      if (!stop) setError(err instanceof ApiError ? err.message : "The thread didn't load.");
    });
    loadStatus().catch(() => undefined);
    const id = window.setInterval(() => {
      if (document.hidden) return;
      loadMessages().catch(() => undefined);
      loadStatus().catch(() => undefined);
    }, 4000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [bookingId, token]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api<{ message: ChatMessage }>(
        `/api/bookings/${bookingId}/messages`,
        { method: "POST", body: JSON.stringify({ channel, text: body }) },
        token,
      );
      setText("");
      setMessages((current) => [...current.filter((item) => item.id !== saved.message.id), saved.message]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That message didn't send.");
    } finally {
      setBusy(false);
    }
  }

  async function linkInstagram() {
    setError("");
    try {
      const next = await api<MessagingStatus>("/api/me/messaging/instagram-code", { method: "POST" }, token);
      setStatus(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't make a link code.");
    }
  }

  const graphNote =
    channel === "whatsapp"
      ? meta?.messaging?.whatsapp
        ? "This goes out through WhatsApp Cloud API to their number, and stays in this thread."
        : "WhatsApp is wired to the Graph API. Add META_GRAPH_TOKEN and WHATSAPP_PHONE_NUMBER_ID and it will deliver. Until then it stays in this thread."
      : channel === "instagram"
        ? meta?.messaging?.instagram
          ? "This goes out through the Instagram Messaging API once they've linked, and stays in this thread."
          : "Instagram is wired to the Graph API. Add META_GRAPH_TOKEN and INSTAGRAM_ACCOUNT_ID and it will deliver. Until then it stays in this thread."
        : "Only the two of you can see this thread.";

  return (
    <section className="mt-6 rounded-[28px] border border-line bg-card p-5">
      <p className="text-xs tracking-[0.16em] text-gold uppercase">After you match</p>
      <h2 className="font-serif text-3xl text-navy">Message them here</h2>
      <p className="mt-1 text-sm text-muted">{graphNote}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {CHANNELS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setChannel(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${channel === item.id ? "bg-navy text-paper" : "bg-paper text-ink"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {channel === "instagram" ? (
        <div className="mt-3 rounded-2xl bg-paper px-3 py-2 text-sm">
          {status?.instagram_linked ? (
            <p>Your Instagram is linked, so replies to the Nook account land in this thread.</p>
          ) : status?.instagram_code ? (
            <p>
              DM <strong>{status.instagram_code}</strong> to the Nook Instagram account. That links your handle
              {status.instagram ? ` (@${status.instagram.replace(/^@/, "")})` : ""} so Graph can deliver messages.
            </p>
          ) : (
            <button type="button" className="text-navy underline" onClick={linkInstagram}>
              Get an Instagram link code
            </button>
          )}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      <ol className="mt-4 max-h-80 space-y-3 overflow-auto">
        {messages.length === 0 ? <li className="text-sm text-muted">No messages yet. Say when you're heading over.</li> : null}
        {messages.map((message) => (
          <li key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.mine ? "bg-navy text-paper" : "bg-paper text-ink"}`}>
              <p>{message.text}</p>
              <p className={`mt-1 text-[11px] ${message.mine ? "text-gold-soft" : "text-muted"}`}>
                {message.channel === "whatsapp" ? "WhatsApp" : message.channel === "instagram" ? "Instagram" : "Nook"}
                {message.detail ? ` · ${message.detail}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <form className="mt-4 flex gap-2" onSubmit={send}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={channel === "nook" ? "Write in Nook" : `Write via ${channel === "whatsapp" ? "WhatsApp" : "Instagram"}`}
          maxLength={1000}
        />
        <button className={btnPrimary} disabled={busy || !text.trim()} type="submit">
          {busy ? "Sending" : "Send"}
        </button>
      </form>
    </section>
  );
}
