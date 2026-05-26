# App Config Compiler

Transform natural language descriptions into complete, validated app architecture specifications — UI configuration, REST API design, database schema, and authorization rules — using a multi-stage LLM pipeline.

![App Config Compiler UI](ui_screenshot.png)
*Replace `ui_screenshot.png` with a screenshot of the web interface.*

---

## How It Works

A 7-stage pipeline that progressively refines a user's plain-English prompt into a structured, cross-validated app specification:

```
User Prompt ("Build a CRM with contacts, dashboard...")
    │
    ▼
[Stage 1] Intent Extraction       → structured_intent.json
    │
    ▼
[Stage 2] System Designer         → system_design.json
    │
    ▼
[Stage 3] Schema Generator        → full_schema.json (4 parallel layers)
          ├── UI Config           → pages, layouts, components
          ├── API Config          → REST endpoints, methods, auth
          ├── DB Schema           → tables, fields, foreign keys
          └── Auth Rules          → roles, route guards, premium gates
    │
    ▼
[Stage 4] Consistency Check       → rule-based cross-layer validation (zero LLM)
    │
    ▼
[Stage 5] Validation + Repair     → surgical LLM fixes for broken layers
    │
    ▼
[Stage 6] Runtime Simulation      → execution readiness checks
    │
    ▼
[Stage 7] Evaluation Logger       → metrics persisted to logs/
```

## Models Used

| Model | Role | When |
|---|---|---|
| **llama-3.3-70b-versatile** | Primary reasoning | Stage 2 (System Design) — the most complex architectural step |
| **llama-3.1-8b-instant** | Fast generation + repair | Stages 1, 3 (all 4 schema generators), Stage 5 repair calls |

Both served via **Groq API** (free tier). The 8b model handles ~85% of calls, keeping 70b usage under the 100K token/day limit.

## Tools Used

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-38B2AC?style=for-the-badge&logo=groq&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)

## Pipeline Features

- **Parallel schema generation** — Stage 3 fires 4 LLM calls concurrently with 500ms stagger to respect Groq rate limits
- **Graceful degradation** — `Promise.allSettled()` ensures one failed layer doesn't abort the rest
- **Surgical repair engine** — Stage 5 fixes only broken layers instead of blind full-pipeline retries
- **Cross-layer consistency checks** — Stage 4 validates API↔DB, UI↔API, Auth↔UI linkages (zero LLM cost)
- **3-stage retry with backoff** — Stages 1-2 get 3 retries; Stage 5 repair recurses max 3 times
- **Runtime simulation** — 5 execution checks (route coverage, CRUD trace, auth flow, premium gating, field mapping)
- **Real-time SSE streaming** — Frontend shows stage-by-stage progress as the pipeline executes

## Challenges Faced

1. **Groq free-tier rate limits** — 100K tokens/day for the 70b model, 30 req/min burst limit. Solved by routing most calls to the 8b model and staggering parallel requests with 500ms delays.

2. **LLM JSON reliability** — Even with `response_format: json_object`, the 70b model occasionally omits fields or produces malformed output. Solved with Zod validation on every stage output and a surgical repair engine that targets only the broken layer.

3. **Cross-layer consistency** — The 4 parallel schema generators (UI/API/DB/Auth) don't coordinate with each other, leading to mismatched references (e.g., a UI component referencing a nonexistent API endpoint). Solved with a rule-based consistency checker that catches these without additional LLM calls.

4. **Balancing quality vs. token cost** — The 70b model produces higher-quality schemas but consumes the daily TPD limit quickly. The 8b model is cheaper but occasionally produces schema validation errors. The current split keeps 70b for the critical design step and 8b for everything else.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Server status + Groq key check |
| `POST` | `/generate` | Run full pipeline, return complete result |
| `POST` | `/generate/stream` | SSE stream — real-time stage progress |
| `GET` | `/metrics` | All logged evaluation runs |
| `GET` | `/*` | Serves built React frontend |

## Getting Started

```bash
# Clone & install
git clone <repo-url>
cd app-config-compiler
npm install

# Set up API key
cp .env.example .env
# Edit .env: add your GROQ_API_KEY from https://console.groq.com

# Start the server
npm run dev

# Open http://localhost:3000 in your browser
```

### Build the frontend
```bash
npm run build:ui
```

### Run evaluations (20 prompts)
```bash
npm run eval
```

## Deployment

Two separate services — the **API server** goes on Render, the **frontend** goes on Vercel.

### Render — Deploy the API Server

The Express backend (`server/index.js`) that runs the pipeline and serves the built UI.

1. Push your repo to GitHub (public)
2. Go to [render.com](https://render.com) → **New** → **Web Service** → Connect your repo
3. Use these settings:

| Setting | Value |
|---|---|
| **Name** | `app-config-compiler-api` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build:ui` |
| **Start Command** | `node server/index.js` |
| **Instance Type** | Free |

4. Add environment variable:

| Key | Value |
|---|---|
| `GROQ_API_KEY` | `gsk_your_key_here` |
| `PORT` | `10000` |

5. Click **Deploy** → get URL like `https://app-config-compiler-api.onrender.com`

> Render free tier sleeps after 15 min idle. First request after sleep takes ~30s.

### Vercel — Deploy the Frontend (Optional)

If you want the React UI hosted separately from the API:

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → Import your GitHub repo
2. Configure:

| Setting | Value |
|---|---|
| **Root Directory** | `ui` |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `dist` (default) |
| **Framework Preset** | Vite |

3. Add environment variable in the UI:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://app-config-compiler-api.onrender.com` |

4. In `ui/vite.config.js`, update the proxy target or point `api.js` to your Render URL

5. Click **Deploy**

Now you have:
- **API Server:** `https://app-config-compiler-api.onrender.com`
- **UI:** `https://app-config-compiler-ui.vercel.app`

The UI makes API calls to the Render-hosted backend.

## Evaluation Datasets

- **Real prompts** — 10 real-world app descriptions (CRM, ecommerce, LMS, job board, social platform, etc.)
- **Edge cases** — 10 intentionally difficult prompts (vague, conflicting, overloaded, underspecified, circular dependencies)

Each run logs metrics to `logs/` including stage latencies, token usage, retries, repair attempts, and execution check results.

## Project Structure

```
├── core/               # Pipeline engine (7 stages + LLM client)
├── schemas/            # Zod validation contracts
├── prompts/            # LLM system prompt templates
├── server/             # Express.js API server
├── ui/                 # React + Vite frontend
├── evaluation/         # Datasets + batch runner
├── logs/               # Run logs (auto-created, gitignored)
└── .env.example        # Environment variable template
```
