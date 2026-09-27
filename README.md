# Dormsurf

Dormsurf helps students find a weekend bed in a Georgia Tech hall—especially for those times when your roommate is out of town and you’d rather not be alone. Sign-up accepts an .edu address when the school in that address is a recognized accredited university. A residence hall is optional, so off-campus Yellow Jackets and students from other schools can still request a stay. You can host your room for someone else once you claim a hall. Matching is based on lifestyle or proximity (like an easy walk from your own dorm). Social details are kept private until a host agrees, keeping things safe and comfortable.

## Run it

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python wsgi.py
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

The app is served at [http://127.0.0.1:43123](http://127.0.0.1:43123). The Vite dev server proxies `/api` to Flask on port 5317.

## When the UI and the API are on different hosts

Both sides assume one origin by default, which is what the dev proxy gives you. To split them, set `VITE_API_URL` in `frontend/.env` to where Flask answers, and list the UI's origin in `CORS_ORIGINS` in the root `.env`:

```bash
# frontend/.env
VITE_API_URL=https://nook-api.example.com

# .env
CORS_ORIGINS=https://nook.example.com
```

`VITE_API_URL` is read at build time, so a change needs another `npm run build`. `CORS_ORIGINS` takes a comma-separated list and rejects every origin outside it. Blank means any origin, which is fine locally because the session travels as an `Authorization` header and never as a cookie. See `frontend/.env.example` and `.env.example`.

## Step through it

The `.vscode` folder is the IDE setup for Cursor and VS Code. After the install steps above:

1. Open the repo folder. If Cursor asks, use the interpreter at `backend/.venv` (on Windows that file is `backend\.venv\Scripts\python.exe`; point **Python: Select Interpreter** at it).
2. Install the recommended Python and Python Debugger extensions if they are not already there.
3. Open **Run and Debug** and choose **Dormsurf: API + UI**. That starts Vite, then launches Flask under the debugger.
4. Set a breakpoint in `backend/nook/routes.py` (search, bookings, and the interview all land there) and use the app at [http://127.0.0.1:43123](http://127.0.0.1:43123). The request will stop on that line.

**Dormsurf: Flask API** is the same debugger without starting the UI, for when Vite is already running in a terminal.

Copy `.env.example` to `.env` in the repo root. Every API key is blank on purpose. The app still runs: profiles, search, the dorm map, and bookings use the local file store and a local lifestyle vector.

## Demo accounts

Both use the password `WeekendNook!`.

| Who | Email | What they're for |
| --- | --- | --- |
| Maya Chen | maya.chen@gatech.edu | Hosting in Glenn |
| Andre Wallace | andre.wallace@gatech.edu | Looking for a bed |

Log in with either email and that password. It keeps working until you change the seed.

## What happens without keys

| Piece | With a key | Without a key |
| --- | --- | --- |
| Accounts | MongoDB | `backend/data/db.json` |
| Email code | SMTP | Shown on the signup screen |
| Interview audio | Muse Voice Transcribe (`muse-voice-transcribe-1.0`) | Browser transcript, or what you type |
| Profile | Muse Spark 1.3 structured output into a Pydantic `LifestyleProfile` | Same schema, filled by a local parser |
| Embedding | 32 lifestyle axes from Muse Spark, L2-normalized, upserted to Pinecone | Same 32 axes from the local encoder, stored on the user |
| Match sort | Cosine similarity, then Muse Spark 1.3 reranks the top bios and writes one sentence about what you have in common | Cosine similarity, then a lifestyle score, with a local one-sentence reason |
| Messages | The thread stays in Dormsurf. Instagram, WhatsApp, and Discord logos open those apps after a match | The thread stays in Dormsurf, and the logos still open |
| Distance sort | Walking estimate via campus hubs, match breaks ties | Same |

Meta's Model API does not ship a separate embeddings endpoint. Dormsurf asks Muse Spark 1.3 for a fixed 32-axis vector inside the structured profile, stores that vector in Pinecone (dimension 32, metric cosine), and compares with cosine similarity. Create the index before setting `PINECONE_API_KEY`.

Demo profiles were embedded with the local encoder. Interviews taken after you add `MODEL_API_KEY` use Muse. The reranker reads bios either way, so mixed profiles still get a Muse pass on match sort when the key is set.

## Flow

1. Enter an .edu address from a recognized accredited university (Georgia Tech, Stanford, and the rest of the school list) and the code from email (or the on-screen preview).
2. Create a password.
3. Claim your room on the campus map, including the floor and unit, or skip it if you live off campus or don't have a Georgia Tech hall. You can open nights later, after a room is claimed. A shared room stays hidden until each roommate you add agrees. From Your space, invite them by the school email on their Dormsurf account. They accept or decline on Requests. A decline keeps the bed hidden until you remove that person and someone agrees. A bedroom Housing lists for one person can be booked without a roommate.
4. Fill in name, gender, age, major, year, hometown, and socials.
5. Answer the interview one question at a time. Talk for as long as you want, then click Next. If an answer is too thin, Dormsurf shows an error and stays on that question. You can type the answer under the question, or switch to a form and enter interests, cleanliness, sleep, noise, and guest notes directly. Back and Next also move between the room, about, and voice steps, and you can reopen any step you have already finished.
6. Search by name, hall, unit number, or bio. Dates are required. Filter sleep, cleanliness, year, major (all selected by default), gender, floor, and dorm type (traditional, suite, apartment).
7. Sort by match or by walking distance. Match runs cosine first, then the bio rerank. Distance walks from the room you claimed.
8. Request a bed and wait. The host accepts or declines. Accepting closes those nights and declines other requests that overlap.
9. Once accepted, both people can message inside Dormsurf: text, photos, one emoji reaction each, and edits or deletes of their own messages. Double-click a message, or the ••• beside it, to open those actions. Instagram, WhatsApp, and Discord logos open a thread in that app. A private Instagram opens the profile for a follow request. Discord opens the profile for a friend request when they are not friends yet, and a message when they are. Each card also has one sentence on why you matched.

## Campus map

The map is a real base map (Leaflet with CARTO Voyager tiles on OpenStreetMap data) with the outlines of 37 Georgia Tech residence halls drawn on top. Outlines, positions, and floor counts come from OpenStreetMap and are stored in `backend/nook/data/gt_halls.json`, so the app never calls OSM at runtime.

- Click a hall for its specs (style, floors, units per floor, bath, kitchen, where a guest sleeps) and a floor-by-floor layout.
- Hover a unit for who's hosting. Green is open, amber has a request waiting, navy is your room.
- Click any unit, or pick a hall and unit in the From / To selectors, to get walking directions from one room to another. The gold line is the path, and the steps include the indoor part: leave your unit, walk, enter the other hall, go to that floor and unit.
- Every bed page shows the walk from your room to that host's unit.

Directions come from free public routers with no API key. Valhalla's pedestrian profile (FOSSGIS server) is tried first and follows walkways, stairs, and crosswalks. OSRM's demo server is the backup; its public instance only has a car profile, so Dormsurf uses its distance and recomputes time at walking pace. If neither answers, a straight-line estimate is drawn as a dashed line. `VALHALLA_URL` and `OSRM_URL` in `.env` point at self-hosted servers if you outgrow the public ones, and `LIVE_ROUTING=0` keeps everything offline. Search's distance sort uses the offline estimate so results never wait on the network.

Floor plans are the official drawings published by Georgia Tech Housing (rooms, bathrooms, study spaces, and kitchens), downloaded with `scripts/fetch_gt_floorplans.py` from each hall page on housing.gatech.edu. They are served from `backend/nook/data/floorplans`. The rooms you can claim are the numbers printed on that drawing (`scripts/extract_gt_rooms.py`), including gaps and lettered rooms such as 116A, not a shortened 101–108 sequence. Click a room on that drawing and a popup shows that room at the size Housing publishes, with the bed, desk, chair, dresser, and wardrobe drawn to those inch sizes. East Campus traditional rooms are listed as approximately 12' × 10' to 15' × 11', and the drawing uses the larger end. Setups follow Housing's loft positions: low, medium, high, and bunked. Room-number positions come from `scripts/extract_room_hotspots.py`. A hall level Housing has not published falls back to an original schematic. Picking a unit still claims it or sets the walk.

## Messages after a match

When a host accepts, the stay page opens a thread that stays in Dormsurf. While the other person is typing, their side of the thread shows a bubble with their name and animated dots. Send text or a photo (JPEG, PNG, GIF, or WebP, up to 4 MB). Double-click a message, or the ••• beside it, to leave one reaction, or to edit or delete your own messages. Choosing another emoji replaces the one you already left. A deleted message stays in the thread as a note that it was removed. Requests keeps that stay open, with a link into the Messages tab. Messages lists everyone you can talk to after an acceptance, and you can search them by name, hall, unit, or major. That tab also shows notifications: unread messages, a host's acceptance until you open the thread, and rooming requests still waiting on your space. Instagram, WhatsApp, and Discord are logos next to the stay thread. A public Instagram opens `ig.me` to that handle. A private Instagram opens `instagram.com` so you can request to follow. WhatsApp opens `wa.me` for their number. Discord uses the user ID from Copy User ID: the logo opens their profile, where Message starts a thread if you are already friends. If they checked that people have to friend them first, the same profile is where you send the friend request. Onboarding has Back and Next across the room, about, and voice steps, and you can return to any step you have already reached.

Muse Spark 1.3 writes the one-sentence "why you match" line when `MODEL_API_KEY` is set. Without it, Dormsurf writes that sentence from shared interests, sleep, cleanliness, major, and hometown.

## Tests

```bash
cd backend
.venv/bin/pytest
```
