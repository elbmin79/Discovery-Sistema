# Fase 1 — Bitácora (registro diario + auditoría)

Objetivo: llenar el vacío de **historial/reportes** y **auditoría** del sistema de salida.
Hoy el único rastro es el modal "Entregados hoy" (solo sesión actual) y `deliveredByStaffName`.
El contexto de voyporti (`docs/context.md` §5 y preguntas de discovery) pide: registro de
entregas, quién completó cada handoff, y reportes para administrativos.

## Alcance

1. **Event log persistente** en el store: cada transición queda registrada (quién, qué, cuándo).
2. **Página `/bitacora`** para personal: tabla de recogidas del día con cadena completa de
   tiempos, filtros, tarjetas resumen, timeline por solicitud y exportación CSV.
3. Entrada desde el tablero de personal (`/personal`) y el demo hub (`/`).

No incluye (fases posteriores): área admin de configuración, autenticación real,
reportes multi-día, notificaciones.

## Modelo de datos

Nuevo en `src/lib/types.ts`:

```ts
export type EventActorRole = "parent" | "kiosk" | "staff";

export type PickupEventType =
  | "trip_created"   // familia anuncia recogida
  | "arrived"        // check-in en kiosco (viaje completo)
  | "status_changed" // staff avanza/deshace un alumno
  | "delivered"      // alumno entregado
  | "cancelled";     // solicitud cancelada

export interface PickupEvent {
  id: string;
  at: string;               // ISO
  type: PickupEventType;
  tripId: string;
  requestId?: string;       // si aplica por alumno
  studentId?: string;
  actorRole: EventActorRole;
  actorName?: string;
  fromStatus?: PickupStatus;
  toStatus?: PickupStatus;
}
```

`Snapshot` gana `events: PickupEvent[]` (más nuevo primero, tope 800).

### Registro de eventos en `MemoryPickupStore`

| Método | Evento(s) | actorRole | actorName |
|---|---|---|---|
| `createTrip` | `trip_created` | parent | tutor(a) |
| `arriveByCode` | `arrived` (1 por viaje) | kiosk | `trip.pickerName` |
| `setRequestStatus` advance | `status_changed` o `delivered` | staff | `staffName` |
| `setRequestStatus` undo | `status_changed` (from/to invertidos) | staff | `staffName` |
| `setRequestStatus` cancel | `cancelled` | staff o parent según `staffName` | — |
| `cancelTrip` | `cancelled` por solicitud | parent | tutor(a) |
| `deliverTrip` | `delivered` por solicitud | staff | `staffName` |

## Compatibilidad

- El snapshot vive como JSON en Supabase (`pickup_state.snapshot`): filas existentes no
  tendrán `events`. Normalizar al leer: `snapshot.events ??= []` en `store/index.ts`
  y en el constructor de `MemoryPickupStore`.
- Sin cambios a contratos de API existentes (todas las mutaciones ya devuelven el
  snapshot completo, que ahora incluye `events`).
- Tras el deploy en dev: `POST /api/demo/reset` para resembrar con eventos.

## Seed

`demo-data.ts` deriva eventos de los viajes/requests ya sembrados para que la bitácora
nazca viva y consistente con los timestamps existentes:

- `trip_created` por cada viaje (tutor del `guardianId`)
- `arrived` por viajes con `arrivedAt`
- `status_changed` por cada `preparingAt`/`readyAt` de request
- `delivered` por cada `deliveredAt` (usa `deliveredByStaffName`)
- Staff de transiciones sembradas según nivel: preescolar → Mtra. Alejandra Ríos,
  primaria → Mtro. Luis Ortega

## Derivación y utilidades (`src/lib/bitacora.ts`, nuevo)

Funciones puras sobre `Snapshot`:

- `buildBitacoraRows(snapshot)` → una fila por `PickupRequest`: alumno, grupo/nivel,
  zona, quién recoge + parentesco, vehículo, método, los 5 timestamps, estado,
  `deliveredByStaffName`, minutos de espera (`arrivedAt → deliveredAt`).
- `buildSummary(rows)` → total, entregados, cancelados, en proceso, espera promedio.
- `eventsForRequest(events, requestId)` → timeline (eventos del request + eventos del
  viaje: created/arrived).
- `toCsv(rows)` → string CSV con escapado; encabezados en español.
- Descarga client-side con BOM (Excel), archivo `bitacora-discovery-YYYY-MM-DD.csv`.

## UI — `/bitacora`

Convención: misma puerta de sesión staff que `/personal` (`useSession("staff")`);
sin sesión → redirect visual a login de staff (componente `StaffLogin` reutilizado).
Español duro, como todo el tablero staff.

Estructura:

1. **Header**: BrandRow (link a `/`), título, link "Volver al tablero" (`/personal`),
   botón "Exportar CSV".
2. **Tarjetas resumen**: Entregados, En proceso, Cancelados, Espera promedio
   (llegada → entrega).
3. **Filtros**: pills de zona (Ambas / Preescolar / Primaria) + pills de estado
   (Todo / Entregados / En proceso / Cancelados).
4. **Tabla** (desktop) / tarjetas (mobile), ordenada por llegada más reciente:
   alumno (avatar + nombre + grado), zona, familia (picker + relación), vehículo,
   tiempos clave (solicitado · llegada · entrega), estado, entregó.
5. **Fila expandible**: timeline con los eventos de esa solicitud
   (`trip_created → arrived → preparando → lista → entregada`, con hora y actor).
6. **Pestaña "Movimientos"**: feed cronológico inverso de todos los eventos
   (auditoría: quién hizo qué y cuándo, incluyendo deshacer y cancelaciones).

## Integración

- `staff-board.tsx`: botón "Bitácora" en header (junto a "En camino"), que linkea a
  `/bitacora`.
- `demo-hub.tsx`: cuarta tarjeta "Bitácora del día" (link directo; la página pide
  sesión staff igual que el tablero).

## Archivos

| Archivo | Cambio |
|---|---|
| `src/lib/types.ts` | `PickupEvent`, `EventActorRole`, `Snapshot.events` |
| `src/lib/store/memory-store.ts` | registrar eventos en las 5 mutaciones |
| `src/lib/store/index.ts` | normalizar `events` al leer snapshot |
| `src/lib/seed/demo-data.ts` | eventos derivados del seed |
| `src/lib/bitacora.ts` | **nuevo** — rows, summary, timeline, CSV |
| `src/app/bitacora/page.tsx` | **nuevo** — página |
| `src/components/staff/bitacora-app.tsx` | **nuevo** — UI completa |
| `src/components/staff/staff-board.tsx` | botón "Bitácora" |
| `src/components/demo/demo-hub.tsx` | cuarta tarjeta |

## Verificación

1. `npm run lint` y `npm run build` (typecheck).
2. `POST /api/demo/reset` → `GET /api/state` incluye `events` sembrados.
3. Flujo manual vía APIs: crear viaje → avanzar → entregar; confirmar eventos nuevos
   en `/api/state` y filas correctas en `/bitacora`.
4. CSV descarga con acentos correctos en Excel (BOM + escapado).
