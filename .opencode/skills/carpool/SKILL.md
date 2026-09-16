---
name: carpool
description: >-
  Full product-context onboarding for Discovery school carpool dismissal.
  Load at session start or when /carpool is invoked — architecture, product
  concepts, flows, and conventions without re-exploring the codebase.
  Use when starting work on discovery-sistema with zero prior context.
  Agent chat is English; app UI/store strings stay Spanish-first.
---

# carpool — Discovery dismissal context

Goal: a model with zero context understands the product and architecture from
**this file alone**, then opens only the files it will touch. Density > exhaustiveness.

## 0. Language (cost rule)

- **Agent ↔ human (chat, reviews, status):** **English only.** Do not summarize or reply in Spanish.
- **App / user-facing code:** **Spanish-first.** UI copy, staff surfaces, store errors thrown to the UI stay Spanish. `/familia` keeps ES/EN dictionaries; staff = Spanish.
- **Git:** commit messages and PR bodies in **English**. Spanish only inside user-facing string literals.

## 1. Product (core idea)

School **carpool dismissal** system for *Discovery American Preschool & Academy*
(Mexicali, B.C.). Started as a sales POC → now the real product in development.

Commercial golden rule: **"We don't ask the school to adapt to the software; we
adapt the software to the school."** Customization is the differentiator vs
Skolable / Vámonos! (both studied; Skolable is parent-driven and fragile: no
schedule engine, noisy geofence, per-student taps).

Hard operational constraints:
- **Continuous carpool line** that never stops; dismissal **staggered by grade**
  (kínder → primaria, ~30 min per group).
- **No on-site screens for staff workflow** (phone/tablet in hand; `/pantalla` is TV info only).
- **Teachers: minimal load** — one tap per action; they NEVER manage exceptions (office/Admin does).
- **Parent does NOT announce "on the way"**: they generate an **inert QR pass** that only
  becomes live when scanned at the kiosk. No walk-ins (everything is by car).
- **Siblings** picked up together; friend families with owner authorization.

## 2. Surfaces (routes)

| Route | What it is |
|---|---|
| `/` | Demo hub: surface cards + "Nueva jornada" (`POST /api/demo/reset`) |
| `/familia` | Parent app (PhoneShell): **Plan de hoy** with kids/schedule/picker/car/tag or QR, day change, "¿Llegarás tarde?", friend families + inbox, account |
| `/kiosco` | Entry: QR/code **and tag mode** (auto photo, arrive without prior notice) |
| `/personal` | Teacher tablet: columns **Esperando → Notificados** (1 tap: Notificar → Entregar), car photos, **Tardes** chip (read-only sheet), "＋ Simular llegadas" |
| `/admin` | **Admin Dashboard** (was *Bitácora*; `/bitacora` redirects): summary cards, **Retrasos** (gold, countdown, red if ETA+15min), Recogidas table + timeline, Movimientos feed, CSV |
| `/pantalla` | TV carousel (Siguientes/Entregados, car photo) |
| `/pase/[token]` | Shareable guest pass (WhatsApp/SMS/copy) |

Demo accounts — parents: `roberto/madrid`, `benjamin/marquez`, `jose/vazquez`,
`ian/ramirez`, `joseluis/torres`; staff: `gabriela/salida`,
`alejandra/preescolar`, `luis/primaria`.

## 3. Architecture

- **Next.js 16** App Router + Turbopack, React 19, Tailwind v4 (tokens in `globals.css`:
  `forest/gold/cream/paper/ink/muted/line/danger`), `lucide-react`, `qrcode`.
  ⚠️ Next 16 differs from training data: read `node_modules/next/dist/docs/` before
  non-trivial APIs (see `AGENTS.md`). Global types `PageProps`/`LayoutProps`/`RouteContext`.
- **Source of truth = `Snapshot`** (`src/lib/types.ts`): school, zones, students, guardians
  (with `friendCode`, `friendIds`), authorizedPeople, vehicles (`photoUrl`, `tagId`), staff,
  trips, requests, guestPasses, **latePickups**, **events**, authorizations.
- **Store** (`src/lib/store/memory-store.ts`): `MemoryPickupStore` mutation methods
  **throw Spanish errors** (shown as-is in UI via `postJson`). Dual mode (`store/index.ts`):
  `globalThis` singleton if no Supabase; with `SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY`
  (`.env.local`, **never read or commit**) persists the full snapshot as ONE JSON row in
  `pickup_state` (id `live`, optimistic concurrency via `version`, 8 retries). State
  **survives restarts**; `/api/demo/reset` reseeds.
- **Client sync**: poll `GET /api/state` every 2s (`useSnapshot`, singleton +
  `rememberSnapshot`); `postJson` ingests the response snapshot immediately.
  `/api/events` (SSE) exists but **is unused**.
- **State machine** (`pickup-machine.ts`): `on_the_way` (pass ready, invisible to school)
  → `arrived` (kiosk) → `preparing` → `ready` → `delivered`; `cancelled`.
  Helpers `canAdvance/canUndo/canCancel/canComplete`; `DELIVERED_VISIBLE_MS` controls
  delivered visibility on board/TV.
- **Audit**: each mutation logs a `PickupEvent` (`trip_created, arrived,
  status_changed, delivered, cancelled, authorization_*, departed, late_announced,
  late_eta_changed, late_cancelled`). Movimientos feed and timelines come from this.
- **Late pickups** (`LatePickup`): ONLY `announced | cancelled`. A message: students + who +
  ETA + note. **No state machine**: amber→red countdown (ETA+15min) is UI-derived
  (`lateIsOverdue/lateCountdownLabel` in `admin-dashboard.ts`). Kiosk does not touch it.
- **Friend families**: `addFriend/removeFriend` by `friendCode`; cross-pickup creates
  `authorization` (pending→approved/denied) that the owner resolves in inbox (`/familia`).
- **Trip close**: tag exit, in-app confirm, or auto at 30 min
  (`closeTrip/closeExpiredTrips`, `departed` event).

## 4. Key file map

- `src/lib/types.ts` — data contract (Snapshot and entities).
- `src/lib/store/{index,memory-store}.ts` — persistence + mutations.
- `src/lib/pickup-machine.ts`, `src/lib/school.ts` (lookups/labels/`vehiclePhoto`),
  `src/lib/admin-dashboard.ts` (rows/CSV/late), `src/lib/i18n/dictionaries.ts` (es/en),
  `src/lib/seed/demo-data.ts` (seed; car SVG fallback; real photos in `public/cars/*.jpg`
  — Wikimedia CC BY-SA, attribution in production; avatars `public/students/*.png`).
- `src/components/{parent,kiosk,staff,tv,demo,ui,brand}/…`
- `src/app/api/…`: `state`, `demo/{reset,populate}`, `trips` (+`arrive`, `arrive-tag`,
  `[id]/{cancel,deliver,depart,status}`), `requests/[id]/{status,authorization}`,
  `late`, `late/[id]`, `account/{vehicles,photo,authorized,friends}`, `auth/login`, `events`.
- `docs/`: `plan-tablero-tablet.md`, `plan-retrasos.md`, `flujo-completo-opciones.md`,
  `phase-1-bitacora.md` (historical).

## 5. Conventions (non-negotiable)

- **ZERO comments in code** (repo rule). Store errors in Spanish, direct.
- UI: Spanish-first; only `/familia` has ES/EN toggle (dictionaries). Staff = Spanish.
- Visual language: **gold = wait/attention**, **forest = progress/ok**, **danger = overdue/risk**;
  cards `rounded-2xl/3xl`, `tabular-nums` for times, no modals on tablet (chaos),
  large buttons (min-h-11), one tap per action.
- React compiler lint: **no `Date.now()/Math.random()` in render** (ticks via state,
  `Clock` pattern), **no sync `setState` in effects**.
- Historical renames you must NOT revive: *Bitácora* → **Admin Dashboard** (`/admin`);
  *"En el kiosco"* state and *"Marcar llegó/Cerrar retraso"* buttons **removed by product
  decision** (late notice is message-only). Do not reintroduce "on the way" announcements
  or walk-ins.
- Git: branches `feat|chore/*` → PR to `main`; **commits and PR bodies in English**;
  PR bodies via `--body-file` (PowerShell 5.1 breaks multiline/quotes). **Never commit `.env.local`.**
- Standard verify: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## 6. Environment quirks (Windows PowerShell 5.1)

- No `&&`: use `; if ($?) { … }`. JSON bodies: UTF-8 bytes
  (`[System.Text.Encoding]::UTF8.GetBytes(...)`), read responses with `RawContentStream`.
- Dev server: `Start-Process node node_modules\next\dist\bin\next dev` (ignore
  "ChildProcess.kill" wrapper noise); build must NOT pipe to `Select-Object`
  (masks exit code).
- App may be in **Supabase mode**: state persists; after touching seed,
  `POST /api/demo/reset`.

## 7. How to use this skill

1. Read this file; summarize context in ≤3 **English** lines to the user.
2. Open ONLY the files to change (Snapshot is the contract; everything else derives).
3. Respect §5 before writing UI/UX or store — Spanish strings in the app, English in chat.
4. When done: lint + tsc (+ build if you touched routes), smoke via API, offer a PR if useful.
