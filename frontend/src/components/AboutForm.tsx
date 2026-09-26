import { useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth";
import type { Socials, User } from "../types";
import { Field, btnPrimary } from "./ui";

export type AboutPayload = {
  name: string;
  gender: string;
  age: number;
  major: string;
  year: string;
  hometown: string;
  socials: Socials;
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
  const [phone, setPhone] = useState(initial?.socials?.phone || "");
  const [discord, setDiscord] = useState(initial?.socials?.discord || "");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
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
        socials: { instagram, phone, discord },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
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
      <Field label="Phone">
        <input value={phone} onChange={(event) => setPhone(event.target.value)} />
      </Field>
      <Field label="Discord">
        <input value={discord} onChange={(event) => setDiscord(event.target.value)} />
      </Field>
      <div className="md:col-span-2">
        <button className={btnPrimary} disabled={busy} type="submit">
          {busy ? "Saving…" : submitLabel}
        </button>
        <p className="mt-2 text-xs text-muted">Socials stay private until someone accepts your request, or you accept theirs.</p>
      </div>
    </form>
  );
}
