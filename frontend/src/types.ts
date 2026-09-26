export type Socials = {
  instagram: string;
  phone: string;
  discord: string;
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
};

export type Score = {
  cosine: number;
  match: number;
  meters: number;
  minutes: number;
  reason: string;
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
};

export type DormDetail = {
  id: string;
  name: string;
  code: string;
  campus: string;
  style: string;
  address: string;
  note: string;
  open_units: number;
  floors: FloorPlan[];
  directions?: Route;
};

export type DormPin = {
  id: string;
  name: string;
  code: string;
  campus: string;
  style: string;
  x: number;
  y: number;
  floors: number[];
  address: string;
  note: string;
  open_units: number;
  yours: boolean;
};

export type MapPoint = { x: number; y: number; lat: number; lng: number; label: string };

export type Route = {
  meters: number;
  minutes: number;
  steps: string[];
  points: MapPoint[];
  maps_url?: string;
  note?: string;
};

export type MapData = {
  landmarks: { id: string; name: string; x: number; y: number }[];
  hubs: { id: string; name: string; x: number; y: number }[];
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
  google: boolean;
  demo: boolean;
  demo_password?: string;
  demo_accounts?: { name: string; email: string; blurb: string }[];
};
