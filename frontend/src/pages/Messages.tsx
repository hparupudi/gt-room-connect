import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { MatchChat } from "../components/MatchChat";
import { Shell } from "../components/Shell";
import { Avatar, Banner } from "../components/ui";
import { formatDates, placeLabel } from "../format";
import type { Inbox, InboxNote } from "../types";

export function Messages() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { token, refresh } = useAuth();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function load(next = query) {
    const needle = next.trim();
    const path = needle ? `/api/inbox?q=${encodeURIComponent(needle)}` : "/api/inbox";
    const body = await api<Inbox>(path, {}, token);
    setInbox(body);
  }

  useEffect(() => {
    let stop = false;
    const handle = window.setTimeout(() => {
      const needle = query.trim();
      const path = needle ? `/api/inbox?q=${encodeURIComponent(needle)}` : "/api/inbox";
      api<Inbox>(path, {}, token)
        .then((body) => {
          if (!stop) {
            setInbox(body);
            setError("");
          }
        })
        .catch((err: unknown) => {
          if (!stop) setError(err instanceof ApiError ? err.message : "Couldn't load messages.");
        });
    }, 180);
    return () => {
      stop = true;
      window.clearTimeout(handle);
    };
  }, [token, query]);

  function seen() {
    load(query)
      .then(() => refresh())
      .catch(() => undefined);
  }

  function openNote(note: InboxNote) {
    if (note.kind === "request") {
      navigate("/host");
      return;
    }
    navigate(`/messages/${note.booking_id}`);
  }

  const threads = inbox?.threads ?? [];
  const notes = inbox?.notifications ?? [];
  const selected = threads.find((thread) => thread.booking_id === bookingId) ?? null;
  const chatting = Boolean(bookingId);

  return (
    <Shell>
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Messages</p>
      <h1 className="font-serif text-4xl text-navy">People you can reach.</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        A thread opens after a rooming request is accepted. Search by name, hall, unit, or major.
      </p>
      {error ? (
        <div className="mt-4">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className={chatting ? "hidden lg:block" : "block"}>
          <label className="block text-sm">
            <span className="sr-only">Search people</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people"
              aria-label="Search people"
            />
          </label>
          <section className="mt-4 rounded-[28px] border border-line bg-card p-4">
            <h2 className="font-serif text-2xl text-navy">Notifications</h2>
            {inbox && notes.length === 0 ? <p className="mt-2 text-sm text-muted">You're caught up. Unread messages, acceptances, and new requests land here.</p> : null}
            <ul className="mt-3 space-y-2">
              {notes.map((note) => (
                <li key={note.id}>
                  <button type="button" onClick={() => openNote(note)} className="w-full rounded-2xl bg-paper px-3 py-2 text-left hover:bg-gold-soft/40">
                    <p className="text-[11px] tracking-[0.14em] text-gold uppercase">{note.kind}</p>
                    <p className="text-sm font-medium">{note.title}</p>
                    <p className="text-sm text-muted">{noteBody(note)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <ul className="mt-4 space-y-2">
            {inbox && threads.length === 0 ? (
              <li className="rounded-[28px] border border-line bg-card p-4 text-sm text-muted">
                {query.trim()
                  ? "No one matches that. You can message someone after a rooming request is accepted."
                  : "No open threads yet. Once a host accepts, both of you can message from here."}
              </li>
            ) : null}
            {threads.map((thread) => {
              const active = thread.booking_id === bookingId;
              return (
                <li key={thread.booking_id}>
                  <Link
                    to={`/messages/${thread.booking_id}`}
                    className={`flex items-start gap-3 rounded-[28px] border p-4 ${active ? "border-navy bg-white" : "border-line bg-card"}`}
                  >
                    <Avatar name={thread.person.name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{thread.person.name}</span>
                        {thread.unread ? (
                          <span className="rounded-full bg-navy px-2 py-0.5 text-[11px] text-paper">{thread.unread}</span>
                        ) : null}
                      </span>
                      <span className="block text-sm text-muted">
                        {placeLabel(thread.person.dorm_name, thread.person.unit)}
                        {thread.dates.length ? ` · ${formatDates(thread.dates)}` : ""}
                      </span>
                      <span className="mt-1 block truncate text-sm text-ink">
                        {thread.last_message
                          ? `${thread.last_message.mine ? "You: " : ""}${thread.last_message.text}`
                          : "Thread is open. Say when you're heading over."}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={chatting ? "block" : "hidden lg:block"}>
          {bookingId ? (
            <>
              <Link to="/messages" className="text-sm text-navy lg:hidden">
                All messages
              </Link>
              {selected ? (
                <div className="mt-3 lg:mt-0">
                  <p className="font-serif text-3xl text-navy">{selected.person.name}</p>
                  <p className="text-sm text-muted">
                    {placeLabel(selected.person.dorm_name, selected.person.unit)}
                    {selected.person.major ? ` · ${selected.person.major}` : ""}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted lg:mt-0">This thread is open because the request was accepted.</p>
              )}
              <MatchChat bookingId={bookingId} showInboxLink={false} onSeen={seen} className="mt-4" />
            </>
          ) : (
            <div className="rounded-[28px] border border-dashed border-line bg-card p-6">
              <p className="font-serif text-3xl text-navy">Pick a person</p>
              <p className="mt-2 text-sm text-muted">
                The stay page keeps the same thread. This is the place to find them again, and to see what needs a look.
              </p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function noteBody(note: InboxNote): string {
  if (note.kind === "request" && /^\d{4}-\d{2}-\d{2}/.test(note.body)) {
    return formatDates(note.body.split(",").map((item) => item.trim()));
  }
  return note.body;
}
