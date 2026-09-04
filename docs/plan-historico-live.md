# Plan — Histórico LIVE de recogidas con foto del auto

Implementado el 4 de septiembre de 2026. Decisiones finales y pasos de despliegue en [histórico: operación y verificación](historico-operacion.md). Las secciones de diagnóstico describen el estado anterior al cambio.

> Convertir los registros del Admin Dashboard en **histórico vivo**: lo de hoy se
> actualiza en tiempo real y lo de días anteriores se consulta por rango
> (**1D · 1W · 1M · personalizado**), con la **foto de llegada del auto** guardada
> fuera del snapshot y visible al tocar el icono **ⓘ** (mismo patrón que `/personal`).
> Escala objetivo: **~1000 autos/día**.

## 1. Diagnóstico: por qué lo actual no escala

Hoy TODO vive en **una sola fila JSON** (`pickup_state`, snapshot completo):

1. `trip.arrivalPhoto` es un **data-URL base64** (JPEG 640px q0.55, ~40–80 KB) que el
   kiosco manda en el POST de llegada (`kiosk-app.tsx` → `/api/trips/arrive*`) y queda
   incrustado en el snapshot.
2. Cada cliente descarga el snapshot completo cada 2 s (`GET /api/state`). Con 1000
   autos/día serían ~60–200 MB de fotos re-descargándose por todos los dashboards.
3. Los trips **nunca se podan** (`events` tiene tope de 800; trips/requests crecen sin
   límite) y no hay histórico: solo existe "el snapshot de hoy" hasta el próximo reset.

Conclusión: las fotos **no pueden vivir en el snapshot ni en Postgres**; los registros
cerrados **no pueden vivir en la fila `live`**. Hay que separar archivo ↔ estado vivo.

### Números (1000 autos/día)

| Concepto | Bajo (640px q0.55) | Alto (1280px q0.7, placa legible) |
|---|---|---|
| Foto promedio | ~60 KB | ~200 KB |
| Por día | ~60 MB | ~200 MB |
| Por mes (20 jornadas) | ~1.2 GB | ~4 GB |
| Por año | ~15 GB | ~48 GB |
| Metadatos (filas) | ~1000 filas/día ≈ 0.5 MB/día — trivial en Postgres, inviable en la fila JSON |

## 2. Investigación: dónde guardar las fotos (estado 2026)

| Opción | Costo aprox. | Pros | Contras | Veredicto |
|---|---|---|---|---|
| **Supabase Storage** (bucket privado) | $0.021/GB/mes extra; Pro incluye 100 GB + 250 GB egress | Ya está en el stack (`@supabase/supabase-js` + service role), S3-compatible, CDN global, **image transforms** on-the-fly, RLS/URLs firmadas, borrado por prefijo trivial | Egress se paga si excedes (~$0.09/GB; cache hits ~3× menos) | ✅ **Recomendada** |
| Cloudflare R2 | $0.015/GB/mes, **egress $0** | El más barato si se consultan mucho las fotos | Proveedor nuevo fuera del stack actual | Alternativa si el egress duele |
| Vercel Blob | ~$0.023/GB/mes + egress | Nativo de Next | Más caro, menos control de ciclo de vida | No aporta sobre Supabase |
| AWS S3 + lifecycle→Glacier | Variable | Lifecycle maduro, archive ultra-barato | Infra/cuentas aparte; overkill para este volumen | Futuro si piden años de archivo |
| Base64 en Postgres / snapshot | $0.125/GB DB | "Simple" | Es el problema actual: infla la fila `live`, el polling de 2 s, backups y el CSV | ❌ Descartada |

**Decisión: Supabase Storage.** Bucket **privado** `arrival-photos`, objetos por fecha
(`YYYY-MM-DD/{tripId}.jpg`) → borrar un día completo = borrar un prefijo, y las reglas
de retención por edad de objeto son directas. La foto contiene placas (y posiblemente
menores al fondo): nunca bucket público; se sirve con **URL firmada de vida corta**.

## 3. Modelo de datos

### 3.1 Tabla `pickup_history` (Postgres/Supabase)

Una fila por **trip cerrado** (entregado+salida, o cancelado). Desnormalizada a
propósito: el listado histórico no debe hacer joins.

```sql
create table pickup_history (
  trip_id text primary key,
  jornada date not null,
  code text not null,
  guardian_id text,
  picker_name text, picker_relation text, picker_kind text,
  vehicle_label text, vehicle_color text, plate text, tag_id text,
  student_names text[] not null default '{}',
  level text, zone_name text,
  method text, arrival_via text, departed_via text,
  requested_at timestamptz, arrived_at timestamptz,
  delivered_at timestamptz, departed_at timestamptz, cancelled_at timestamptz,
  delivered_by text, status text not null, wait_minutes int,
  photo_path text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index pickup_history_jornada_idx on pickup_history (jornada desc, arrived_at desc nulls last);
```

- `photo_path`: ruta relativa dentro del bucket (`2026-09-02/trip-abc123.jpg`).
- `detail`: requests + eventos del trip (para el timeline del ⓘ) y cualquier campo extra.
- `jornada`: fecha local de la salida (America/Tijuana); es la llave de los rangos 1D/1W/1M.

### 3.2 Snapshot (sin cambios de forma, más delgado de fondo)

- `arrivalPhoto` pasa de data-URL a **ruta de storage** (o data-URL en modo memoria/dev).
  `isCapturedPhoto` en `school.ts` se actualiza: capturada = no es `data:image/svg+xml`
  **y** no es `/cars/*`.
- Cuando el ciclo del trip se cierra (`closeTrip` / cancela definitivo), el trip y sus
  requests **salen del snapshot** y se archivan en `pickup_history`. El snapshot vuelve
  a ser solo "la jornada viva" (decenas de filas, no miles).

### 3.3 Modo memoria (dev sin Supabase)

El store mantiene `history: HistoryRow[]` en memoria (tope ~5000 filas, FIFO) y las
fotos siguen como data-URL. Mismo contrato de API: el modo se oculta tras `store/index.ts`.

## 4. Store / API

### 4.1 Archivo al cerrar (Fase 1)

En `memory-store.ts`, al cerrar ciclo:

- `archiveTrip(trip)`: construye la fila histórica (con `detail` de requests/eventos),
  la inserta (tabla o array en memoria), y remueve trip + requests + eventos de ese
  trip del snapshot. El feed "Movimientos" queda como **solo-hoy** (decisión documentada).
- `closeExpiredTrips` archiva igual (los timeout también generan histórico).

En modo Supabase, `commit_pickup_state` inserta el archivo y actualiza `live` en la
misma transacción con control de versión. Los reintentos no duplican filas ni
permiten borrar un viaje sin guardar antes su histórico.

### 4.2 Fotos hacia storage (Fase 2)

- `/api/trips/arrive` y `/api/trips/arrive-tag` siguen recibiendo el data-URL (el kiosco
  no cambia); **la ruta servidor** decodifica y sube a Storage con el admin client
  (`getSupabaseAdmin().storage.from("arrival-photos").upload(path, bytes)`), y guarda
  solo `photo_path` en el trip. Si Storage falla, la llegada **no** falla: queda la foto
  de referencia del vehículo (degradación elegante, como hoy sin cámara).
- `GET /api/photos/[day]/[tripId]` → `createSignedUrl` (60 s) → redirect 302. Same-origin:
  `next/image` funciona con `unoptimized` sin tocar config.
- Optimización posterior (opcional): subir desde el kiosco con *signed upload URL* para
  que el POST de llegada ya no cargue el binario.

### 4.3 API de histórico (Fase 1)

- `GET /api/history?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200&offset=0`
  - Respuesta: `{ days: [{ jornada, summary, rows: HistoryRow[] }], total }`.
  - Si el rango incluye **hoy**, el servidor **mezcla** las filas vivas del snapshot
    (marcadas `live: true`) con las ya archivadas del día → el histórico es LIVE.
  - Rangos pasados: consulta única a la tabla (índice por `jornada`), sin polling.

## 5. UI — `/admin` (Fase 3)

- Tercera pestaña **Histórico** junto a `Recogidas`/`Movimientos` (Recogidas sigue siendo
  la consola viva de hoy; no se toca).
- Chips de rango (mismo patrón `FilterPill`): **Hoy · 7 días · 30 días · Personalizado**
  (dos `<input type="date">`). Cambiar rango = fetch único; solo "Hoy" usa el poll de 2 s.
- Resumen del rango: reutiliza `SummaryCard` (total, entregados, cancelados, espera media).
- Lista agrupada por día con encabezado (`Miércoles 2 de septiembre · 983 recogidas`);
  filas = misma tabla actual (`RowDesktop`/`RowMobile`) con dos cambios:
  - Columna/fecha cuando el rango > 1 día.
  - Botón **ⓘ** por fila — mismo botón circular `Info` de la card del tablero
    (`dismissal-board.tsx:522`) — que abre el `Sheet` con la foto del auto:
    imagen + badge `Foto de llegada · hora` / `Foto de referencia del auto` (clon del
    `InfoSheet` de `/personal`, `dismissal-board.tsx:585`), datos de quién recogió,
    tiempos y timeline (desde `detail`).
  - La foto se pide perezosamente al abrir el sheet (`/api/photos/...`); si 404 →
    fallback del vehículo → SVG, igual que `arrivalPicture`.
- **Exportar CSV** del rango visible (extender `toCsv`; nombre `historico-desde-hasta.csv`).

Reglas visuales de siempre: oro/forest/danger, `tabular-nums`, botones min-h-11, sin
modales en tablet (el sheet es overlay centrado como en `/personal`), español-first.

## 6. Orden de fases (build)

| Fase | Contenido | Archivos clave | Estado |
|---|---|---|---|
| 0 | Decisiones: bucket, retención, schema SQL de este doc | `docs/` + SQL en Supabase | ✅ |
| 1 | Archivo al cerrar + tabla/array histórico + `GET /api/history` + snapshot delgado | `types.ts`, `memory-store.ts`, `store/index.ts`, `api/history`, `closeTrip/closeExpiredTrips` | ✅ |
| 2 | Fotos a Supabase Storage + endpoint firmada + adaptar `/personal`, `/pantalla`, `/kiosco`, `/admin` | `api/trips/arrive*`, `api/photos/[day]/[tripId]`, `school.ts` (`isCapturedPhoto`) | ✅ |
| 3 | UI Histórico en `/admin`: rangos 1D/1W/1M/custom + sheet ⓘ con foto + CSV por rango | `admin-dashboard-app.tsx`, `admin-dashboard.ts` | ✅ |
| 4 | Operación: retención/lifecycle, backfill del snapshot actual, monitoreo de bucket | SQL/Storage rules, script backfill | ✅ |

Cada fase: `npm run lint` + `npx tsc --noEmit` + `npm run build` (se tocaron rutas) +
smoke por API + `POST /api/demo/reset` si cambió el seed. Antes de implementar: leer
`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` y
`12-images.md` (Next 16 difiere del entrenamiento, ver `AGENTS.md`).

## 7. Verificación por fase

- **1**: cerrar un trip por API → aparece en `GET /api/history?from=hoy&to=hoy` con
  `live` mezclado; el snapshot ya no contiene el trip; el histórico de ayer responde sin
  tocar el snapshot.
- **2**: llegada por kiosco → el objeto existe en el bucket, `arrivalPhoto` es ruta;
  `/personal` y `/pantalla` muestran la foto vía redirect firmada; sin cámara → fallback.
- **3**: chips 1D/1W/1M/custom filtran; "Hoy" se actualiza solo (<2 s); ⓘ abre la foto;
  CSV del rango descarga con fechas en el nombre.
- **4**: regla de retención borra prefijos de +N días en el bucket; backfill importa lo
  existente sin duplicar `trip_id`.

## 8. Retención y privacidad (decisión de la escuela)

- **Propuesta por defecto: 90 días** de fotos y registros; el borrado de fotos es por
  prefijo de fecha (1 llamada) y el de filas por `jornada < cutoff`. Configurable.
- Las fotos de llegada pueden capturar **placas y menores al fondo**: bucket privado +
  URLs firmadas + aviso en el aviso de privacidad del colegio. El staff solo ve fotos
  desde el dashboard autenticado (sesión staff, como hoy).
- El histórico por familia ("retrasos/reincidencias") sale gratis de la tabla: consulta
  por `guardian_id` — candidato a reporte mensual (futuro).

## 9. Decisiones confirmadas

1. Retención de fotos y registros: 90 días.
2. Fotografía general del auto en 720p (máximo 1280 × 720, JPEG 0.7).
3. El histórico lo consulta la administración de oficina.
4. El CSV incluye solo la referencia estable de la foto.
5. Los Retrasos se archivan diariamente y permanecen visibles al consultar su jornada.
