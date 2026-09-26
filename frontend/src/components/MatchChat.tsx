import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import type { ChatMessage } from "../types";
import { Banner, btnPrimary } from "./ui";

export function MatchChat({ bookingId }: { bookingId: string }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadMessages() {
    const body = await api<{ messages: ChatMessage[] }>(`/api/bookings/${bookingId}/messages`, {}, token);
    setMessages(body.messages);
  }

  useEffect(() => {
    let stop = false;
    loadMessages().catch((err: unknown) => {
      if (!stop) setError(err instanceof ApiError ? err.message : "The thread didn't load.");
    });
    const id = window.setInterval(() => {
      if (document.hidden) return;
      loadMessages().catch(() => undefined);
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
        { method: "POST", body: JSON.stringify({ channel: "nook", text: body }) },
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

  return (
    <section className="mt-6 rounded-[28px] border border-line bg-card p-5">
      <p className="text-xs tracking-[0.16em] text-gold uppercase">After you match</p>
      <h2 className="font-serif text-3xl text-navy">Message them here</h2>
      <p className="mt-1 text-sm text-muted">Only the two of you can see this thread. It stays in Nook.</p>
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
              <p className={`mt-1 text-[11px] ${message.mine ? "text-gold-soft" : "text-muted"}`}>In Nook</p>
            </div>
          </li>
        ))}
      </ol>
      <form className="mt-4 flex gap-2" onSubmit={send}>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Write in Nook" maxLength={1000} />
        <button className={btnPrimary} disabled={busy || !text.trim()} type="submit">
          {busy ? "Sending" : "Send"}
        </button>
      </form>
    </section>
  );
}
