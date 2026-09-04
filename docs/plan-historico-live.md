# Plan — Histórico LIVE de recogidas con foto del auto

Estado actualizado al 4 de septiembre de 2026: implementado y verificado localmente. El dashboard conserva el diseño original y muestra las recogidas directamente, sin pestañas. Las migraciones y el backfill de producción siguen siendo pasos de despliegue, detallados en [histórico: operación y verificación](historico-operacion.md). El diagnóstico y los costos de referencia describen el diseño inicial, no una cotización vigente.

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

| Concepto | Bajo (640px q0.55) | Elegido (1280 × 720, q0.7, foto general) |
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
  record jsonb not null,
  created_at timestamptz not null default now()
);
create index pickup_history_jornada_idx on pickup_history (jornada desc, arrived_at desc nulls last);
```

- `photo_path`: ruta relativa dentro del bucket (`2026-09-02/trip-abc123.jpg`).
- `detail`: requests + eventos del trip (para el timeline del ⓘ) y cualquier campo extra.
- `jornada`: fecha local de la salida (America/Tijuana); es la llave de los rangos 1D/1W/1M.
- `record`: contrato completo `HistoryRow`, incluidos los identificadores de alumnos y datos de detalle. La tabla del dashboard presenta una fila por alumno; el archivo, la paginación y los resúmenes de la API contabilizan viajes.
- `pickup_late_history`: archivo independiente de avisos de Retrasos con `id`, `jornada` y `record`. Conserva nombres, aviso y eventos aunque no exista una recogida asociada.

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

- `archiveClosedTrips()`: construye la fila histórica (con `detail` de requests/eventos),
  la inserta (tabla o array en memoria), y remueve trip + requests + eventos de ese
  trip del snapshot. Se elimina el feed separado de Movimientos del dashboard; la auditoría de cada viaje permanece en el detalle ⓘ.
- `closeExpiredTrips` archiva igual (los timeout también generan histórico).

En modo Supabase, `commit_pickup_state` inserta el archivo y actualiza `live` en la
misma transacción con control de versión. Los reintentos no duplican filas ni
permiten borrar un viaje sin guardar antes su histórico.

### 4.2 Fotos hacia storage (Fase 2)

- `/api/trips/arrive`, `/api/trips/arrive-tag` y `/api/trips/[id]/arrive` reciben el data-URL. El kiosco captura JPEG de máximo 1280 × 720, calidad 0.7, sin ampliar la imagen; **la ruta servidor** decodifica y sube a Storage con el admin client
  (`getSupabaseAdmin().storage.from("arrival-photos").upload(path, bytes)`), y guarda
  solo `photo_path` en el trip. Si Storage falla, la llegada **no** falla: queda la foto
  de referencia del vehículo (degradación elegante, como hoy sin cámara).
- `GET /api/photos/[day]/[tripId]` → `createSignedUrl` (60 s) → redirect 302. Same-origin:
  `next/image` funciona con `unoptimized` sin tocar config.
- Optimización posterior (opcional): subir desde el kiosco con *signed upload URL* para
  que el POST de llegada ya no cargue el binario.

### 4.3 API de histórico (Fase 1)

- `GET /api/history?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200&offset=0&status=all&zone=...`
  - Requiere sesión firmada de administración de oficina.
  - Respuesta: `{ from, to, includesToday, rows, summary, latePickups, days, total }`.
  - `status`: `all`, `delivered`, `active` o `cancelled`; `zone`: nombre de puerta o vacío. Se aplican antes de paginar, tanto en memoria como en SQL. La cuarta migración agrega esta consulta filtrada.
  - Si el rango incluye **hoy**, el servidor **mezcla** las filas vivas del snapshot
    (marcadas `live: true`) con las ya archivadas del día → el histórico es LIVE.
  - Rangos pasados: consulta única a la tabla (índice por `jornada`), sin polling.

## 5. UI — `/admin` (Fase 3)

- Una sola pantalla, abierta en **Hoy** por defecto. No hay pestañas ni encabezado llamado Histórico; se eliminan los selectores Recogidas / Movimientos / Histórico.
- Se conserva el diseño original: tarjetas **Entregados · En proceso · Cancelados · Espera promedio**, sección Retrasos con personajes, cuenta regresiva y cancelación de avisos vivos, y tabla de alumnos con sus avatares.
- Una **única fila centrada** de filtros, sin saltos de línea, con divisores verticales finos entre grupos:
  - **Ambas puertas · Preescolar · Primaria**.
  - **Todo · Entregados · En proceso · Cancelados**.
  - **Hoy · 7 días · 30 días · Personalizado**.
- En pantallas estrechas la fila permite desplazamiento horizontal. Personalizado abre Desde / Hasta debajo; los demás grupos conservan su posición.
- Solo Hoy consulta cada 2 segundos. El texto largo de actualización se reemplaza por **un punto verde intermitente y “En vivo”**, discreto, en la esquina superior derecha del encabezado de la tabla. Se respeta la preferencia de movimiento reducido. Otros rangos no muestran ese indicador.
- Columnas originales: **Alumno, Familia, Aviso, Llegada, Entrega, Salida, Estado, Entregó**, más **ⓘ**. Cada alumno conserva su personaje y grado; la vista móvil mantiene sus tarjetas. Las filas se ordenan por fecha descendente; el rango aparece encima y la jornada específica se ve en el detalle y CSV.
- El botón **ⓘ** abre la foto, quién recogió, tiempos y eventos del viaje. La foto se solicita al abrir: captura → referencia del vehículo → SVG si falla. No se descarga al listar filas.
- **Exportar CSV** permanece en la cabecera. Exporta el rango y filtros seleccionados, recorre todas las páginas y genera `recogidas-desde-hasta.csv`, con la referencia estable de foto.

Reglas visuales de siempre: oro/forest/danger, `tabular-nums`, botones min-h-11, sin
modales en tablet (el sheet es overlay centrado como en `/personal`), español-first.

## 6. Orden de fases (build)

| Fase | Contenido | Archivos clave | Estado |
|---|---|---|---|
| 0 | Decisiones: bucket, retención, schema SQL de este doc | `docs/` + SQL en Supabase | ✅ |
| 1 | Archivo al cerrar + tabla/array histórico + `GET /api/history` + snapshot delgado | `types.ts`, `memory-store.ts`, `store/index.ts`, `api/history`, `closeTrip/closeExpiredTrips` | ✅ |
| 2 | Fotos a Supabase Storage + endpoint firmada + adaptar `/personal`, `/pantalla`, `/kiosco`, `/admin` | `api/trips/arrive*`, `api/photos/[day]/[tripId]`, `school.ts` (`isCapturedPhoto`) | ✅ |
| 3 | Dashboard único con diseño original, personajes, filtros centrados en una fila, indicador En vivo, ⓘ y CSV filtrado | `admin-dashboard-app.tsx`, `history-panel.tsx`, consulta SQL filtrada | ✅ |
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
- **3**: dashboard abre directamente en Hoy; personajes visibles; los tres grupos de filtros comparten una fila centrada con dos divisores. En vivo aparece con punto verde en el encabezado; Hoy consulta cada 2 s y los otros rangos no hacen polling. ⓘ abre la foto y el CSV incluye rango y referencias. Estado y puerta se filtran antes de paginar.
- **4**: regla de retención borra prefijos de +N días en el bucket; backfill importa lo
  existente sin duplicar `trip_id`.

## 8. Retención y privacidad (decisión de la escuela)

- **Decisión confirmada: 90 días** de fotos y registros. Se listan prefijos por jornada y se eliminan objetos mediante Storage en lotes de hasta 1,000; después se borran filas con `jornada < cutoff`. Se conserva el día límite.
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
6. Se conserva el diseño original con personajes; una sola fila centrada de filtros de puerta, estado y fecha, separada por líneas verticales.
7. No hay pestañas de Histórico o Movimientos. El indicador En vivo es un punto verde intermitente con texto breve en la esquina superior derecha de la tabla.
