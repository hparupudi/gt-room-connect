# Nook

Nook is a weekend couch for Georgia Tech students. When a roommate is out of town, another Yellow Jacket can request the room. You match on how you live, or on the walk from your own hall. Socials stay hidden until the host accepts.

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

## Step through it

The `.vscode` folder is the IDE setup for Cursor and VS Code. After the install steps above:

1. Open the repo folder. If Cursor asks, use the interpreter at `backend/.venv` (on Windows that file is `backend\.venv\Scripts\python.exe`; point **Python: Select Interpreter** at it).
2. Install the recommended Python and Python Debugger extensions if they are not already there.
3. Open **Run and Debug** and choose **Nook: API + UI**. That starts Vite, then launches Flask under the debugger.
4. Set a breakpoint in `backend/nook/routes.py` (search, bookings, and the interview all land there) and use the app at [http://127.0.0.1:43123](http://127.0.0.1:43123). The request will stop on that line.

**Nook: Flask API** is the same debugger without starting the UI, for when Vite is already running in a terminal.

Copy `.env.example` to `.env` in the repo root. Every API key is blank on purpose. The app still runs: profiles, search, the dorm map, and bookings use the local file store and a local lifestyle vector.

## Demo accounts

Both use the password `WeekendNook!`.

| Who | Email | What they're for |
| --- | --- | --- |
| Maya Chen | maya.chen@gatech.edu | Hosting in Glenn |
| Andre Wallace | andre.wallace@gatech.edu | Looking for a couch |

The login screen can enter as either of them. Set `DEMO_LOGIN=0` to hide those buttons. The password still works until you change the seed.

## What happens without keys

| Piece | With a key | Without a key |
| --- | --- | --- |
| Accounts | MongoDB | `backend/data/db.json` |
| Email code | SMTP | Shown on the signup screen |
| Interview audio | Muse Voice Transcribe (`muse-voice-transcribe-1.0`) | Browser transcript, or what you type |
| Profile | Muse Spark 1.3 structured output into a Pydantic `LifestyleProfile` | Same schema, filled by a local parser |
| Embedding | 32 lifestyle axes from Muse Spark, L2-normalized, upserted to Pinecone | Same 32 axes from the local encoder, stored on the user |
| Match sort | Cosine similarity, then Muse Spark 1.3 reranks the top bios and writes one sentence about what you have in common | Cosine similarity, then a lifestyle score, with a local one-sentence reason |
| WhatsApp and Instagram | Graph API sends the thread to their number or linked Instagram, and replies come back through the webhook | The same thread stays inside Nook |
| Distance sort | Walking estimate via campus hubs, match breaks ties | Same |

Meta's Model API does not ship a separate embeddings endpoint. Nook asks Muse Spark 1.3 for a fixed 32-axis vector inside the structured profile, stores that vector in Pinecone (dimension 32, metric cosine), and compares with cosine similarity. Create the index before setting `PINECONE_API_KEY`.

Demo profiles were embedded with the local encoder. Interviews taken after you add `MODEL_API_KEY` use Muse. The reranker reads bios either way, so mixed profiles still get a Muse pass on match sort when the key is set.

## Flow

1. Enter a `@gatech.edu` address and the code from email (or the on-screen preview).
2. Create a password.
3. Claim your room on the campus map, including the floor and unit. You can open nights now or later.
4. Fill in name, gender, age, major, year, hometown, and socials.
5. Record a 30–60 second answer to the interview prompts. If the mic is blocked, type while the timer runs.
6. Search by name, hall, unit number, or bio. Dates are required. Filter sleep, cleanliness, year, major (all selected by default), gender, floor, and dorm type (traditional, suite, apartment).
7. Sort by match or by walking distance. Match runs cosine first, then the bio rerank. Distance walks from the room you claimed.
8. Request a couch and wait. The host accepts or declines. Accepting closes those nights and declines other requests that overlap.
9. Once accepted, both people can see Instagram, phone, and Discord, and a thread opens. Send it in Nook, or on WhatsApp and Instagram through the Graph API. Each card also has one sentence on why you matched.

## Campus map

The map is a real base map (Leaflet with CARTO Voyager tiles on OpenStreetMap data) with the outlines of 37 Georgia Tech residence halls drawn on top. Outlines, positions, and floor counts come from OpenStreetMap and are stored in `backend/nook/data/gt_halls.json`, so the app never calls OSM at runtime.

- Click a hall for its specs (style, floors, units per floor, bath, kitchen, where a guest sleeps) and a floor-by-floor layout.
- Hover a unit for who's hosting. Green is open, amber has a request waiting, navy is your room.
- Click any unit, or pick a hall and unit in the From / To selectors, to get walking directions from one room to another. The gold line is the path, and the steps include the indoor part: leave your unit, walk, enter the other hall, go to that floor and unit.
- Every couch page shows the walk from your room to that host's unit.

Directions come from free public routers with no API key. Valhalla's pedestrian profile (FOSSGIS server) is tried first and follows walkways, stairs, and crosswalks. OSRM's demo server is the backup; its public instance only has a car profile, so Nook uses its distance and recomputes time at walking pace. If neither answers, a straight-line estimate is drawn as a dashed line. `VALHALLA_URL` and `OSRM_URL` in `.env` point at self-hosted servers if you outgrow the public ones, and `LIVE_ROUTING=0` keeps everything offline. Search's distance sort uses the offline estimate so results never wait on the network.

Floor diagrams are original schematics, not official housing plans.

## Messages after a match

When a host accepts, the stay page opens a thread. In Nook is always available. WhatsApp uses the other person's phone through the WhatsApp Cloud API (`WHATSAPP_PHONE_NUMBER_ID` plus `META_GRAPH_TOKEN`). Instagram uses the Messaging API once they DM the link code shown in the thread to the Nook Instagram account (`INSTAGRAM_ACCOUNT_ID`). Replies arrive at `POST /api/webhooks/meta`. The verify token is `META_WEBHOOK_VERIFY_TOKEN`. If `META_APP_SECRET` is set, webhook posts must carry `X-Hub-Signature-256`.

Muse Spark 1.3 writes the one-sentence "why you match" line when `MODEL_API_KEY` is set. Without it, Nook writes that sentence from shared interests, sleep, cleanliness, major, and hometown.

## Tests

```bash
cd backend
.venv/bin/pytest
```
