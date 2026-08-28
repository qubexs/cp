# Cinematic Prompt Lab — Prompt Forge

> **Turbopack Next.js 16.3.1** • **Your API keys only** • Forge locked, production-ready prompts for **Veo 3 / Kling / Wan / Luma / Runway** (video) and **Flux / SDXL / Midjourney / Nano Banana** (image) — no video/image is generated, only the prompt.

Example output (kampung keropok lekor) matches your locked template:
```
[Style & Visuals] Pixar-inspired ...
LOCKED CHARACTER IDENTITY: Atuk_LP = Atuk 0.95 ...
SCENE: lively Malaysian kampung market ... elderly_man_tomato_bag_1.webp influence 0.9
SEED: 12345 locked. DURATION: 8s  MOTION STRENGTH: 0.3
CAMERA: wide establishing shot ...
CHARACTER SPATIAL ORDER LOCKED FROM LEFT TO RIGHT: [Atuk] - [Atan] - [Acik] - [Stall]
CRITICAL PROP LOCK: Atuk holds ONE orange translucent bag in ANATOMICAL RIGHT HAND ...
ACTION: group walks ...
DIALOGUE: Acik says "Sedapnya..." ...
CONTINUITY LOCK: single shot, zero cuts ...
NEGATIVE PROMPT: hand swapping, bag transfer, face drift ...
```

---

## Two Apps in One Repo

| App | Folder | Run | URL |
|-----|--------|-----|-----|
| **Prompt Forge** (full toolkit: Forge + Cinematic Lab + Scene Stage + 3D Set) | `D:\JOHAR\prompt-forge\` (root) | `run-prompt-forge.bat` | http://localhost:3000 |
| **Cinematic Prompt Lab — Standalone** (only Cinematic Lab) | `D:\JOHAR\prompt-forge\Cinematic\` | `Cinematic\run.bat` | http://localhost:3000 |

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

---

## API Keys — Your Keys, No Backend

All calls go **directly from your browser to the provider** — keys are stored in `localStorage` under `promptforge_accounts`, never on a server. Rotation + auto-failover if one key fails.

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
   - Video example: `Atuk, Atan, Acik walk to keropok lekor stall. Atuk holds orange bag in RIGHT hand. Spatial order Atuk-Atan-Acik-stall. Dialogue: ...`
   - Image example: `Atuk, Atan, Acik at pasar, Atuk holds orange bag in RIGHT hand, order Atuk-Atan-Acik-stall, warm pose`
2. **Drop reference files** (or `Browse`) — images/video/scripts are read via `readAttachment` and sent as `image_url`/`video_url` to the model (40MB limit)
3. Pick **Model**: `Gemini 2.5 Flash` (best price/perf, video+image), `2.5 Pro`, `Qwen2.5-VL`, `GPT-4o` etc
4. Click **✨ AI Forge Image Prompt** or **🎬 AI Forge Video Prompt** → streams via your keys
5. Result appears as **Ready Prompt** (AI or Manual toggle) → **Copy** / **Download .txt** / **🎲 Random Seed**

### D. Manual Builder (fine-tune hints)

- **Locked Character Identity**: `Name | Code | Weight | Description` → outputs `Atuk_LP = Atuk 0.95, ...`
- **Scene + Reference**: upload image/video or type filename `elderly_man_tomato_bag_1.webp` + `influence 0.9`
- **Camera, Spatial Order, Prop Lock, Action, Dialogue (+ Line), Performance, Continuity, Negative**
- Builder state feeds AI as `BUILDER HINTS` if your idea is vague
- Blank vs Kampung Example loader, word/char count

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
- Client-side only — `openrouter.ts` → `providers.ts` → `fetch` with `AbortController` (300s), no API routes
- Auth: `localStorage` (`promptforge_accounts`, `promptforge_session`), SHA-256

MIT — your keys, your prompts.
