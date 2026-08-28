# Cinematic Prompt Lab — Prompt Forge

> **Turbopack Next.js 16.3.1** • **Your API keys only** • Forge locked, production-ready prompts for **Veo 3 / Kling / Wan / Luma / Runway** (video) and **Flux / SDXL / Midjourney / Nano Banana** (image) — no video/image is generated, only the prompt.

Example output (A Giant Bean Tree) matches your locked template — works in both `D:\user\prompt-forge\` and `D:\user\prompt-forge\Cinematic\`:
```
[Style & Visuals] Pixar-inspired high-end cinematic 3D animation, ultra-detailed quality, physically accurate lighting, fluid natural motion, realistic spatial depth, and polished cinematic rendering.
LOCKED CHARACTER IDENTITY: Lila_LP = Lila 0.95, Milo = Milo 0.95, Grandpa_LP = Grandpa 0.95. Maintain 100% facial identity ...
SCENE: colossal bean tree bursting through a sunny village square, trunk twisting into the clouds, shimmering leaves, villagers gathered around ... Scene reference giant_bean_tree_01.webp influence 0.9
SEED: 77777 locked. DURATION: 8s  MOTION STRENGTH: 0.3
CAMERA: wide establishing shot, eye-level, slow tracking toward the tree ...
CHARACTER SPATIAL ORDER LOCKED FROM LEFT TO RIGHT: [Grandpa] - [Lila] - [Milo] - [Bean Tree + Villagers]
CRITICAL PROP LOCK: Grandpa holds ONE small woven basket with a glowing bean exclusively in his ANATOMICAL RIGHT HAND ...
ACTION: trio walks slowly toward the giant tree, looking up in awe ...
DIALOGUE: Lila says "Wow, it touches the sky..."  Grandpa says "We grew this from one brave seed."  Milo says "Can we climb to the clouds?"
CONTINUITY LOCK: single shot, zero cuts, zero teleportation ...
NEGATIVE PROMPT: hand swapping, bag transfer, face drift, morphing ...
```

---

## Two Apps in One Repo

| App | Folder | Run | URL |
|-----|--------|-----|-----|
| **Prompt Forge** (full toolkit: Forge + Cinematic Lab + Scene Stage + 3D Set) | `D:\user\prompt-forge\` (root) | `run-prompt-forge.bat` | http://localhost:3000 |
| **Cinematic Prompt Lab — Standalone** (only Cinematic Lab) | `D:\user\prompt-forge\Cinematic\` | `Cinematic\run.bat` | http://localhost:3000 |

Both are **Turbopack** (`next dev --turbopack`) and share the same `lib/cinematic.ts` engine.

---

## Quick Start (Windows)

### 1. Clone
```bash
git clone https://github.com/qubexs/cp.git
cd cp
# or if you cloned prompt-forge:
# git clone https://github.com/qubexs/prompt-forge.git
```

### 2. Install & Run — Full App
```bash
cd prompt-forge          # if you are in cp, you are already there
npm install
npm run dev              # --turbopack
# or double-click run-prompt-forge.bat
```
Open http://localhost:3000 → Sidebar → **Cinematic Lab**

### 3. Install & Run — Standalone Only
```bash
cd Cinematic
npm install
npm run dev              # --turbopack
# or double-click Cinematic\run.bat  (or root run-cinematic.bat)
```
Open http://localhost:3000

### 4. Build (production check)
```bash
npm run build   # Turbopack build, both apps
npm run lint
```

---

## Batch Files (double-click)

- `run-prompt-forge.bat` — starts full Prompt Forge
- `run-cinematic.bat` — starts standalone Cinematic Lab from root
- `Cinematic\run.bat` — starts standalone when you are inside `Cinematic\`
- `runserver.bat` — alias for `npm run dev`
- `install.bat` — **choose DB backend + migrate** (same PC, see below)
- `start-db.bat` / `stop-db.bat` — start/stop Postgres container

---

## PostgreSQL — Same PC (Not Cloud) — Install Choice + Migrate

**All data stays on this PC. No cloud. Docker, Native, or Node-only.**

### Install — choose backend (first run)

Double-click **`install.bat`** (or `npm run db:migrate` manually). If no `.env` found → choice menu:

```
Choose backend:
  1) Docker Postgres (needs Docker Desktop)  [Recommended]
  2) Native Postgres (needs postgresql.org installer)
  3) Node.js-only PGlite/SQLite (no server, file dev.db) [Zero deps]
```

- **1 Docker:** creates `docker-compose.yml` (`postgres:16-alpine`, volume `pgdata` at project root, `promptforge/promptforge_local_pw@localhost:5432/promptforge`), `docker compose up -d`, writes `.env` + `Cinematic/.env` + `.install-state.json`, then `npx prisma generate && npx prisma migrate dev --name init && npm run build && npm run dev`
- **2 Native:** checks `psql --version`, if missing opens https://www.postgresql.org/download/windows/, creates DB `promptforge`, same `.env` as Docker, then `prisma migrate dev`
- **3 Node:** sets `DATABASE_URL=file:./dev.db` (`DB_PROVIDER=sqlite`), no Docker/service, just `prisma migrate dev` — single file `dev.db` at project root

All paths share same `.env` (`DATABASE_URL`, `ENCRYPTION_KEY`, `SESSION_SECRET`) and both apps (`root` + `Cinematic\`) use it.

### If already installed — re-run `install.bat`

Detects existing `.env` + `.install-state.json`:

```
Found: backend=docker, DB=promptforge
  1) Migrate DB (keep data, prisma migrate deploy)
  2) Re-configure backend (switch docker↔native↔node, with export/import)
  3) Fresh reset (DROP DATA)
  4) Just start (docker compose up + npm run dev)
```

- **Migrate** keeps users/keys, runs `prisma migrate deploy` + `prisma generate`
- **Re-configure** auto-exports `User`/`StoredKey` (encrypted) from old DB, switches `DATABASE_URL`/`DB_PROVIDER`, imports to new DB (backup `pgdata.backup.2025-08-28`)
- **LocalStorage import:** on first login, if `promptforge_accounts` in `localStorage` has keys but DB has 0 keys, browser auto `POST /api/auth/migrate` imports them then clears local

### Verify

```bash
# Docker
docker compose up -d && docker ps | findstr promptforge-db
npx prisma studio        # view User / StoredKey (keyEncrypted)
# Native
psql "postgresql://promptforge:promptforge_local_pw@localhost:5432/promptforge" -c "\dt"
# Node
dir dev.db
```

Both `npm run build` (root + `Cinematic`) must pass — they do (see `prisma/schema.prisma` with `User`, `StoredKey`, `Session`).

---

## API Keys — Your Keys, Postgres Encrypted (Same PC)

Keys are **encrypted (AES-256-GCM, `ENCRYPTION_KEY`) in Postgres on this PC** (`StoredKey.keyEncrypted`), never in cloud. Rotation + auto-failover if one key fails. Calls go via **server proxy** `POST /api/chat` (decrypts on server, never exposes plain key to browser) or fallback to direct browser → provider if DB offline. Legacy `localStorage` (`promptforge_accounts`) is kept as fallback + auto-migrated to Postgres on first login.

1. **Sign up / Login** (local account, stored in browser) → header shows `Keys 0/0`
2. **Manage Keys** → `Keys` button or `Key Manager` → Add:
   - **OpenRouter** `sk-or-v1-...` → https://openrouter.ai/keys (covers Gemini, GPT, Claude, Qwen, etc)
   - **Google AI Studio** `AIza...` → https://aistudio.google.com/app/apikey (Gemini direct)
   - **Hugging Face** `hf_...` → https://huggingface.co/settings/tokens
3. Toggle keys on/off, `Next up` shows rotation order. Add several for failover.

> No key = AI Forge button disabled. Add one to enable `✨ AI Forge`.

---

## How to Use

### A. Image vs Video Tabs

Top of **Cinematic Prompt Lab** has two tabs:

- **🖼️ Image** — single-frame lock: Style, Identity, Scene, Camera (static 50mm), Spatial Order, Prop Lock, Pose/Performance, Negative. Good for Midjourney/Flux/SDXL.
- **🎬 Video** — full lock: + Seed (locked), Duration (8s default), Motion Strength (0.3), Action, Dialogue + Performance, Continuity Lock. Good for Veo/Kling/Wan.

Builder fields auto-hide for Image (no Seed/Duration/Motion/Dialogue/Continuity).

### B. Style & Visuals (Multi-Choice)

- Default pre-checked: **Pixar 3D** (`Pixar-inspired high-end cinematic 3D animation...`)
- 14 presets: Pixar, Photorealistic 8K, Ghibli, Anime, Disney, Documentary Natural, Hollywood Blockbuster, Film Noir B&W, Vintage 70s, Cyberpunk Neon, Fantasy Epic, Horror Dark, Watercolor Painterly, Comic Cel-Shaded
- **Dropdown → check multiple** → pills show labels, panel below shows **Selection style prompts (n)** with each full prompt text
- `+ Add` custom style, `Reset to Pixar only`, `Clear all`, `×` on pills removes
- Manual AI hint + final `[Style & Visuals] style1, style2, ...` line respects all selected

### C. AI Forge (with reference files)

1. Pick tab (Image/Video), type **Scene Idea** in plain language:
   - Video example: `Grandpa, Lila and Milo walk to the Giant Bean Tree in the village square. Grandpa holds glowing bean basket in RIGHT hand. Spatial order Grandpa-Lila-Milo-Tree. Dialogue: Lila "Wow, it touches the sky..." Grandpa "We grew this from one brave seed."`
   - Image example: `Grandpa, Lila, Milo at Giant Bean Tree, Grandpa holds glowing bean basket in RIGHT hand, order Grandpa-Lila-Milo-Tree, warm awe pose, eye-level 50mm`
2. **Drop reference files** (or `Browse`) — images/video/scripts are read via `readAttachment` and sent as `image_url`/`video_url` to the model (40MB limit)
3. Pick **Model**: `Gemini 2.5 Flash` (best price/perf, video+image), `2.5 Pro`, `Qwen2.5-VL`, `GPT-4o` etc
4. Click **✨ AI Forge Image Prompt** or **🎬 AI Forge Video Prompt** → streams via your keys
5. Result appears as **Ready Prompt** (AI or Manual toggle) → **Copy** / **Download .txt** / **🎲 Random Seed**

### D. Manual Builder (fine-tune hints)

- **Locked Character Identity**: `Name | Code | Weight | Description` → outputs `Lila_LP = Lila 0.95, Grandpa_LP = Grandpa 0.95 ...`
- **Scene + Reference**: upload image/video or type filename `giant_bean_tree_01.webp` + `influence 0.9`
- **Camera, Spatial Order, Prop Lock, Action, Dialogue (+ Line), Performance, Continuity, Negative**
- Builder state feeds AI as `BUILDER HINTS` if your idea is vague
- Blank vs Giant Bean Tree Example loader, word/char count

### E. Ready Prompt

Bottom panel shows either **AI Generated** or **Manual Builder** prompt (22 rows, mono). Copy for Veo/Kling/Wan/Midjourney. Switching Image/Video tabs swaps `cinematic-image-prompt.txt` vs `cinematic-video-prompt.txt` on download.

---

## Project Structure

```
app/page.tsx / layout.tsx / globals.css  — Prompt Forge shell + Sidebar
components/tools/CinematicBuilder.tsx     — Image+Video Lab (dual AI + manual)
components/AuthScreen.tsx / KeyManager.tsx / AttachZone.tsx
lib/cinematic.ts  — PIXAR_DEFAULT, STYLE_PRESETS, DEFAULT_STATE, buildCinematicImagePrompt(), buildCinematicPrompt(), buildCinematicUserPrompt(), CINEMATIC_*_SYSTEM_PROMPT
lib/openrouter.ts / providers.ts / types.ts / auth.ts  — multi-provider chatWithKeys + rotation
Cinematic/   — standalone copy (same engine, isolated lockfile, turbopack.root)
```

---

## Troubleshooting

- **No keys enabled** → `Keys 0/N` red pill → open `Key Manager` → add `sk-or-v1-` or `AIza` and ensure toggle is green
- **Request timed out (5m)** → reference too large → compress image/video <40MB or pick `Gemini 2.5 Flash-Lite`
- **Workspace root warning** in `Cinematic\` build → fixed via `turbopack.root: __dirname` in `Cinematic/next.config.ts`
- **Port 3000 in use** → `npm run dev -- -p 3001`

---

## Tech

- Next.js 16.3.1 (App Router, Turbopack), React 19, Tailwind 4, TypeScript 5
- **Postgres same PC**: `prisma` (User/StoredKey/Session), `docker-compose.yml` (postgres:16-alpine), `lib/db.ts` singleton, `lib/crypto.ts` AES-256-GCM, `lib/session.ts` jose JWT httpOnly, `app/api/auth/*`, `app/api/keys/*`, `app/api/chat/*`
- Fallback still works: `lib/auth.ts` hybrid → tries `/api/*` (Postgres), falls back to `localStorage` (`promptforge_accounts`, SHA-256) + `install.bat` migrate
- AI: `openrouter.ts` → `providers.ts` → `fetch` with `AbortController` (300s), now proxied via `POST /api/chat` when DB available

MIT — your keys, your prompts.
