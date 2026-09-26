export type SocialLink = {
  href: string;
  label: string;
  kind: "message" | "profile";
};

export type Socials = {
  instagram: string;
  instagram_private?: boolean;
  phone: string;
  discord: string;
  discord_id?: string;
  discord_friend_request?: boolean;
  links?: Partial<Record<"instagram" | "whatsapp" | "discord", SocialLink>>;
};

export type User = {
  id: string;
  email?: string;
  name: string;
  gender: string;
  age: number | null;
  major: string;
  year: string;
  year_label: string;
  hometown: string;
  dorm_id: string;
  dorm_name: string | null;
  dorm_code?: string;
  floor: number | null;
  unit: string;
  style?: string;
  campus?: string;
  address?: string;
  open_dates: string[];
  bio: string;
  tags: string[];
  interests: string[];
  hobbies: string[];
  cleanliness: string | null;
  sleep_timing: string | null;
  sleep_start?: string;
  wake_time?: string;
  noise?: string;
  guest_notes: string;
  onboarding_complete: boolean;
  onboarding_step: "room" | "about" | "voice" | "done";
  embedding_model?: string;
  socials_visible: boolean;
  socials?: Socials;
  transcript?: string;
  incoming_pending?: number;
  inbox_unread?: number;
};

export type Score = {
  cosine: number;
  match: number;
  meters: number;
  minutes: number;
  reason: string;
  reason_model?: string;
};

export type SearchResponse = {
  results: { host: User; scores: Score }[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  sort: "match" | "distance";
  ranker: string;
  dates: string[];
};

export type HostCard = {
  id: string;
  name: string;
  open_dates: string[];
  sleep_timing?: string;
  cleanliness?: string;
  pending: boolean;
};

export type RoomShape = {
  unit: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: string;
  status: "open" | "pending" | "yours" | "idle";
  hosts: HostCard[];
  yours: boolean;
  hosting?: boolean;
};

export type FloorPlan = {
  floor: number;
  open_units: number;
  style: string;
  viewBox: number[];
  hall: { x: number; y: number; w: number; h: number; label: string } | null;
  fixtures: { x: number; y: number; w: number; h: number; label: string }[];
  rooms: RoomShape[];
  image?: string | null;
  pdf?: string | null;
  source_page?: string | null;
  official?: boolean;
};

export type HallSpecs = {
  room: string;
  bath: string;
  kitchen: string;
  guest_space: string;
};

export type HallBase = {
  id: string;
  name: string;
  code: string;
  campus: string;
  style: string;
  lat: number;
  lng: number;
  units_per_floor: number;
  address: string;
  note: string;
  osm_name: string | null;
  osm: string | null;
  footprint: [number, number][][];
  specs: HallSpecs;
};

export type DormDetail = HallBase & {
  open_units: number;
  floors: FloorPlan[];
  directions?: Route;
};

export type DormPin = HallBase & {
  floors: number[];
  open_units: number;
  yours: boolean;
};

export type RouteEnd = {
  dorm_id: string;
  dorm_name: string;
  unit: string | null;
  floor: number | null;
  lat: number;
  lng: number;
};

export type Route = {
  source: "valhalla" | "osrm" | "estimate";
  meters: number;
  minutes: number;
  walk_minutes?: number;
  steps: string[];
  points: [number, number][];
  maps_url?: string;
  note?: string;
  from?: RouteEnd;
  to?: RouteEnd;
};

export type MapData = {
  center: { lat: number; lng: number };
  dorms: DormPin[];
  home?: string;
};

export type Booking = {
  id: string;
  status: string;
  dates: string[];
  message: string;
  match: number;
  minutes: number;
  reason: string;
  reason_model?: string;
  decline_reason: string;
  created_at: string;
  guest: User;
  host: User;
  role: "host" | "guest";
};

export type Option = { id: string; label: string; hint?: string };

export type Meta = {
  majors: string[];
  years: Option[];
  genders: Option[];
  sleep: Option[];
  cleanliness: Option[];
  styles: Option[];
  questions: string[];
  demo: boolean;
  demo_password?: string;
  demo_accounts?: { name: string; email: string; blurb: string }[];
};

export type InboxPerson = {
  id: string;
  name: string;
  dorm_name: string;
  unit: string;
  major: string;
  year_label: string;
};

export type InboxThread = {
  booking_id: string;
  dates: string[];
  role: "host" | "guest";
  person: InboxPerson;
  last_message: { text: string; created_at: string; mine: boolean } | null;
  unread: number;
  opened: boolean;
};

export type InboxNote = {
  id: string;
  kind: "message" | "accepted" | "request";
  title: string;
  body: string;
  booking_id: string;
  created_at: string;
};

export type Inbox = {
  threads: InboxThread[];
  notifications: InboxNote[];
  unread: number;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  channel: "nook";
  text: string;
  created_at: string;
  delivery: string;
  detail: string;
  mine: boolean;
};
