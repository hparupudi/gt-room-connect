import { useState } from "react";
import type { SubmitEvent } from "react";

import { useAuth } from "../auth";
import type { User } from "../types";
import { Field, btnPrimary } from "./ui";

export type AboutPayload = {
  name: string;
  gender: string;
  age: number;
  major: string;
  year: string;
  hometown: string;
  socials: {
    instagram: string;
    instagram_private: boolean;
    phone: string;
    discord: string;
    discord_id: string;
    discord_friend_request: boolean;
  };
};

export function AboutForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<User>;
  submitLabel: string;
  onSubmit: (payload: AboutPayload) => Promise<void>;
}) {
  const { meta } = useAuth();
  const [name, setName] = useState(initial?.name || "");
  const [gender, setGender] = useState(initial?.gender || "woman");
  const [age, setAge] = useState(initial?.age ? String(initial.age) : "19");
  const [major, setMajor] = useState(initial?.major || meta?.majors[0] || "");
  const [year, setYear] = useState(initial?.year || "2");
  const [hometown, setHometown] = useState(initial?.hometown || "");
  const [instagram, setInstagram] = useState(initial?.socials?.instagram || "");
  const [instagramPrivate, setInstagramPrivate] = useState(Boolean(initial?.socials?.instagram_private));
  const [phone, setPhone] = useState(initial?.socials?.phone || "");
  const [discord, setDiscord] = useState(initial?.socials?.discord || "");
  const [discordId, setDiscordId] = useState(initial?.socials?.discord_id || "");
  const [discordFriendRequest, setDiscordFriendRequest] = useState(Boolean(initial?.socials?.discord_friend_request));
  const [busy, setBusy] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        name,
        gender,
        age: Number(age),
        major,
        year,
        hometown,
        socials: {
          instagram,
          instagram_private: instagramPrivate,
          phone,
          discord,
          discord_id: discordId,
          discord_friend_request: discordFriendRequest,
        },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="about-form" className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
      <Field label="Name">
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <Field label="Gender">
        <select value={gender} onChange={(event) => setGender(event.target.value)}>
          {(meta?.genders ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Age">
        <input type="number" min={16} max={40} value={age} onChange={(event) => setAge(event.target.value)} required />
      </Field>
      <Field label="Year">
        <select value={year} onChange={(event) => setYear(event.target.value)}>
          {(meta?.years ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Major">
        <select value={major} onChange={(event) => setMajor(event.target.value)}>
          {(meta?.majors ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Hometown">
        <input value={hometown} onChange={(event) => setHometown(event.target.value)} placeholder="Decatur, GA" required />
      </Field>
      <Field label="Instagram">
        <input value={instagram} onChange={(event) => setInstagram(event.target.value)} placeholder="hidden until you match" />
      </Field>
      <Field label="WhatsApp number">
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="404-555-0142" />
      </Field>
      <Field label="Discord username">
        <input value={discord} onChange={(event) => setDiscord(event.target.value)} placeholder="maya" />
      </Field>
      <Field label="Discord user ID">
        <input value={discordId} onChange={(event) => setDiscordId(event.target.value)} placeholder="the long number from Copy User ID" />
      </Field>
      <label className="flex items-start gap-2 text-sm md:col-span-2">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={instagramPrivate} onChange={(event) => setInstagramPrivate(event.target.checked)} />
        <span>My Instagram is private. Matches open my profile so they can request to follow, instead of a message.</span>
      </label>
      <label className="flex items-start gap-2 text-sm md:col-span-2">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={discordFriendRequest} onChange={(event) => setDiscordFriendRequest(event.target.checked)} />
        <span>People have to friend me on Discord first. The logo opens my profile for a friend request. Leave this off if they can already message me.</span>
      </label>
      <div className="md:col-span-2">
        <button className={btnPrimary} disabled={busy} type="submit">
          {busy ? "Saving…" : submitLabel}
        </button>
        <p className="mt-2 text-xs text-muted">Socials stay private until someone accepts your request, or you accept theirs.</p>
      </div>
    </form>
  );
}
