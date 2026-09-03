---
name: carpool
description: Onboarding de contexto completo del sistema de salida escolar Discovery (school carpool pickup/dismissal). Cargar al iniciar cualquier sesión en este repo o cuando se invoque /carpool — arquitectura, conceptos de producto, flujos y buenas prácticas, sin re-explorar el códigobase. Use when starting work on discovery-sistema with zero prior context.
---

# carpool — onboarding de contexto (Discovery Salida)

Objetivo: que un modelo con 0 contexto entienda TODO el producto y su arquitectura leyendo
solo este archivo, y luego abra únicamente los archivos que va a tocar. Densidad > exhaustividad.

## 1. El producto (idea central)

Sistema de **salida escolar (carpool dismissal)** para *Discovery American Preschool &
Academy* (Mexicali, B.C.). Nació como POC de ventas → hoy es el producto real en desarrollo.

Regla de oro comercial: **"No le pedimos a la escuela que se adapte al software; adaptamos
el software a la escuela."** La personalización es el diferenciador frente a Skolable / Vámonos!
(ambos estudiados; Skolable es parent-driven y frágil: sin motor de horarios, geofence ruidoso,
taps por alumno).

Realidad operativa del cliente (restricciones duras):
- **Línea de carpool continua** que nunca se detiene; salida **escalonada por grado**
  (kínder → primaria, ~30 min por grupo).
- **Sin pantallas en sitio** (todo es teléfono/tablet en mano del personal; `/pantalla` es solo TV informativa).
- **Maestros con carga mínima**: un toque por acción; NUNCA gestionan excepciones (eso es oficina/Admin).
- **El padre NO anuncia "voy en camino"**: genera un **pase QR inerte** que solo cobra vida al
  escanearse en el kiosco. No hay walk-ins (todo es auto).
- **Hermanos** se recogen juntos; familias amigas (friend families) con autorización del dueño.

## 2. Superficies (rutas)

| Ruta | Qué es |
|---|---|
| `/` | Demo hub: tarjetas por superficie + "Nueva jornada" (`POST /api/demo/reset`) |
| `/familia` | App del padre (PhoneShell): pase QR, "¿Llegarás tarde?", familias amigas + inbox de autorizaciones, cuenta (fotos/autos/autorizados) |
| `/kiosco` | Entrada: QR/código **y modo tag** (foto automática, llegada sin aviso previo) |
| `/personal` | Tablet del maestro: columnas **Esperando → Notificados** (1 toque: Notificar → Entregar), fotos de auto, chip **Tardes** (hoja solo-lectura), botón "＋ Simular llegadas" |
| `/admin` | **Admin Dashboard** (antes *Bitácora*; `/bitacora` redirige): summary cards, sección **Retrasos** (oro, countdown, rojo si ETA+15min), tabla Recogidas + timeline, feed Movimientos, CSV |
| `/pantalla` | Carrusel para TV (Siguientes/Entregados, foto del auto) |
| `/pase/[token]` | Pase de invitado compartible (WhatsApp/SMS/copia) |

Cuentas demo — padres: `roberto/madrid`, `benjamin/marquez`; staff: `gabriela/salida`,
`alejandra/preescolar`, `luis/primaria`.

## 3. Arquitectura

- **Next.js 16** App Router + Turbopack, React 19, Tailwind v4 (tokens en `globals.css`:
  `forest/gold/cream/paper/ink/muted/line/danger`), `lucide-react`, `qrcode`.
  ⚠️ Next 16 difiere de tu entrenamiento: lee `node_modules/next/dist/docs/` antes de APIs
  no triviales (ver `AGENTS.md`). Tipos globales `PageProps`/`LayoutProps`/`RouteContext`.
- **Fuente de verdad = `Snapshot`** (`src/lib/types.ts`): school, zones, students, guardians
  (con `friendCode`, `friendIds`), authorizedPeople, vehicles (`photoUrl`, `tagId`), staff,
  trips, requests, guestPasses, **latePickups**, **events**, authorizations.
- **Store** (`src/lib/store/memory-store.ts`): clase `MemoryPickupStore` con métodos de
  mutación que **lanzan errores en español** (se muestran tal cual en UI vía `postJson`).
  Doble modo (`store/index.ts`): singleton en `globalThis` si no hay Supabase; con
  `SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY` (`.env.local`, **nunca leer ni commitear**)
  guarda el snapshot completo como UNA fila JSON en `pickup_state` (id `live`, concurrencia
  optimista por `version`, 8 reintentos). El estado **persiste entre reinicios**;
  `/api/demo/reset` resiembra.
- **Sync cliente**: polling de `GET /api/state` cada 2s (`useSnapshot`, singleton +
  `rememberSnapshot`); `postJson` ingesta el snapshot de la respuesta al instante.
  `/api/events` (SSE) existe pero **no se usa**.
- **Máquina de estados** (`pickup-machine.ts`): `on_the_way` (pase listo, invisible para la
  escuela) → `arrived` (kiosco) → `preparing` → `ready` → `delivered`; `cancelled`.
  Helpers `canAdvance/canUndo/canCancel/canComplete`; `DELIVERED_VISIBLE_MS` controla
  visibilidad de entregados en tablero/TV.
- **Auditoría**: cada mutación loguea un `PickupEvent` (`trip_created, arrived,
  status_changed, delivered, cancelled, authorization_*, departed, late_announced,
  late_eta_changed, late_cancelled`). El feed "Movimientos" y los timelines salen de ahí.
- **Retrasos** (`LatePickup`): SOLO `announced | cancelled`. Es un mensaje: alumnos + quién +
  ETA + nota. **Sin máquina de estados**: el countdown ámbar→rojo (ETA+15min) es derivado en UI
  (`lateIsOverdue/lateCountdownLabel` en `admin-dashboard.ts`). El kiosco NO lo toca.
- **Familias amigas**: `addFriend/removeFriend` por `friendCode`; recogida cruzada crea
  `authorization` (pending→approved/denied) que el dueño resuelve en su inbox (`/familia`).
- **Cierre del ciclo del trip**: salida por tag, confirmación en app, o auto a 30 min
  (`closeTrip/closeExpiredTrips`, evento `departed`).

## 4. Mapa de archivos clave

- `src/lib/types.ts` — contrato de datos (Snapshot y entidades).
- `src/lib/store/{index,memory-store}.ts` — persistencia + mutaciones.
- `src/lib/pickup-machine.ts`, `src/lib/school.ts` (lookups/labels/`vehiclePhoto`),
  `src/lib/admin-dashboard.ts` (rows/CSV/retardos), `src/lib/i18n/dictionaries.ts` (es/en),
  `src/lib/seed/demo-data.ts` (seed; fallback SVG de auto; fotos reales en `public/cars/*.jpg`
  — Wikimedia CC BY-SA, atribución en producción; avatares `public/students/*.png`).
- `src/components/{parent,kiosk,staff,tv,demo,ui,brand}/…`
- `src/app/api/…`: `state`, `demo/{reset,populate}`, `trips` (+`arrive`, `arrive-tag`,
  `[id]/{cancel,deliver,depart,status}`), `requests/[id]/{status,authorization}`,
  `late`, `late/[id]`, `account/{vehicles,photo,authorized,friends}`, `auth/login`, `events`.
- `docs/`: `plan-tablero-tablet.md`, `plan-retrasos.md`, `flujo-completo-opciones.md`,
  `phase-1-bitacora.md` (histórico).

## 5. Convenciones y buenas prácticas (no negociables)

- **CERO comentarios en código** (regla del repo). Errores de store en español, directos.
- UI: español-first; solo `/familia` tiene toggle ES/EN (diccionarios). Staff = español.
- Lenguaje visual: **oro = espera/atención**, **forest = progreso/ok**, **danger = vencido/riesgo**;
  cards `rounded-2xl/3xl`, `tabular-nums` para horas, sin modales en tablet (caos),
  botones grandes (min-h-11), un toque por acción.
- React compiler lint: **nada de `Date.now()/Math.random()` en render** (ticks por estado,
  patrón `Clock`), **nada de `setState` síncrono en effects**.
- Renombres históricos que NO debes revivir: *Bitácora* → **Admin Dashboard** (`/admin`);
  estado *"En el kiosco"* y botones *"Marcar llegó/Cerrar retraso"* **eliminados por decisión
  de producto** (el aviso de retraso es solo mensaje). No reintroducir anuncios "voy en camino"
  ni walk-ins.
- Git: ramas `feat|chore/*` → PR a `main`; commits en español; cuerpos de PR con
  `--body-file` (PowerShell 5.1 rompe multiline/quotes). **Nunca commitear `.env.local`.**
- Verificación estándar: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## 6. Quirks del entorno (Windows PowerShell 5.1)

- Sin `&&`: usa `; if ($?) { … }`. JSON bodies: bytes UTF-8
  (`[System.Text.Encoding]::UTF8.GetBytes(...)`), leer respuestas con `RawContentStream`.
- Dev server: `Start-Process node node_modules\next\dist\bin\next dev` (ignorar el ruido
  "ChildProcess.kill" del wrapper); el build NO debe pipearse a `Select-Object`
  (enmascara el exit code).
- La app puede estar en **modo Supabase**: el estado persiste; tras tocar el seed,
  `POST /api/demo/reset`.

## 7. Cómo trabajar con este skill

1. Lee este archivo; resume contexto en ≤3 líneas al usuario.
2. Abre SOLO los archivos a modificar (el Snapshot es el contrato; todo lo demás deriva).
3. Respeta §5 antes de escribir UI/UX o store.
4. Al terminar: lint + tsc (+ build si tocaste rutas), smoke por API, y ofrece PR si aplica.
