# Plan — Recogida con retraso ("Llegaré tarde")

> **Simplificación (v2):** el aviso es solo un mensaje — hora + quién + alumnos.
> Sin máquina de estados: `announced | cancelled`. El kiosco NO enlaza el aviso, no
> hay "En el kiosco", "Marcar llegó", "Cerrar retraso" ni auto-resolución.
> La ETA vencida se deriva en la UI (ámbar→rojo) y ya. Esto reemplaza el §2/§3
> de fases (A–F) de abajo, que se documenta como histórico.

> Canal de **excepción**: el padre avisa que no llegará a la hora habitual, con
> **ETA** (hora estimada) y **quién** recogerá. El colegio gestiona la espera.

## 1. Contexto y regla de oro

El flujo normal **no cambia**: el padre no anuncia nada en el día a día; llega al
kiosco, escanea QR, y el alumno aparece en la tablet. El único gesto activo del
padre es esta **excepción** ("hoy llego tarde") — es información que la oficina
NECESITA antes de activar protocolos. Esto no re-introduce el "voy en camino":
es un aviso de incumplimiento del horario, no un anuncio de salida.

**Supuesto a confirmar:** ¿el aviso de retraso lo puede hacer cualquier tutor en
cualquier momento, o solo dentro de una ventana (p. ej. desde 30 min antes de la
salida del grupo)? → Plan: sin ventana (demo), simple.

Flujo completo:

```
Padre (/familia)                Oficina (/admin)              Kiosco / tablet
────────────────                ───────────────────              ──────────────
"Llegaré tarde"     ──────►     Alerta viva con cuenta           Al escanear al
+ quién recoge                  regresiva (ETA) · color          llegar: el retraso
+ ETA (±15/30/60)                oro → rojo si se pasa           se ENLACEA solo
+ nota (opcional)               Acciones: marcado llegó,         ("ya llegó la persona")
                                cancelar/actualizar, registro
     (tablet docente: chip informativo pasivo, sin acción — ver §6)
```

## 2. Modelo de datos (`src/lib/types.ts`)

```ts
export type LatePickupStatus =
  | "announced"   // avisado, dentro de la ETA
  | "overdue"     // pasó la ETA + tolerancia (15 min) — escala
  | "arrived"     // llegó y escaneó en kiosco (enlazado al trip)
  | "resolved"    // alumnos entregados
  | "cancelled";  // el padre canceló / ya no aplica

export interface LatePickup {
  id: string;
  guardianId: string;
  studentIds: string[];
  pickerKind: PickerKind;          // self | authorized | guest (mismo vocabulario que trips)
  pickerName: string;
  pickerRelationEs: string;
  pickerRelationEn: string;
  guestPhone?: string;
  etaAt: string;                   // ISO — hora estimada de llegada
  note?: string;
  createdAt: string;
  updatedAt: string;
  status: LatePickupStatus;
  linkedTripId?: string;           // trip del kiosco que lo cerró
  resolvedAt?: string;
}
```

- `Snapshot` gana `latePickups: LatePickup[]` (normalizar como `events`, retro-compat).
- Nuevos tipos de evento (bitácora/Movimientos): `late_announced`, `late_eta_changed`,
  `late_cancelled`, `late_arrived`, `late_resolved` → auditoría y timeline gratis.
- Seed: **un retraso activo** (p. ej. Abuela Rojas · +20 min · Diego Ruiz) para que
  la consola nazca con vida en el demo. `overdue` no sembrado (se calcula por reloj).

## 3. Store / API

`memory-store.ts`:
- `createLatePickup(input)` — valida guardian + students; si hay alumnos ya en un
  trip activo → error ("esos alumnos ya tienen recogida en curso").
- `updateLateEta(id, etaAt)` / `cancelLate(id)` (padre) → eventos `late_eta_changed` / `late_cancelled`.
- `linkLateOnArrival(trip)` — **llamado dentro de `arriveByCode`**: si llega un trip
  de un guardian con `latePickup` activo que incluye alguno de sus alumnos →
  status `arrived`, `linkedTripId`, evento `late_arrived`. Al entregar esos alumnos
  (`deliverTrip` / `complete`) → `resolved`.
- `overdue` es **derivado** (status `announced` && now > etaAt + 15 min), no almacenado —
  nada que sincronizar.

Rutas (mismos patrones, sin auth, devuelven snapshot completo):
- `POST /api/late` — crear (padre).
- `POST /api/late/[id]` — `{ action: "eta" | "cancel" }`.
- `POST /api/late/[id]/resolve` — oficina marca "llegó" manualmente (sin kiosco).
- Oficina **nunca edita** la ETA del padre — solo enlaza/cancela (separación de roles).

## 4. Fase A — Padre: pantalla "Llegaré tarde" (`/familia`)

Entrada: en `parent-home`, botón secundario bajo el CTA normal:
**"¿Llegarás tarde? Avisar al colegio"**.

Pasos (reutilizando componentes de `parent-setup`: selección de hijos, picker,
teléfono de visita):
1. Hijos afectados (multi-check, mismo patrón).
2. Quién recoge: yo / persona autorizada / invitado (nombre + WhatsApp opcional).
3. ETA: chips rápidos `+15 · +30 · +45 · +60 min` + input de hora manual
   (guardar como timestamp absoluto; mostrar "≈ 3:45 p.m.").
4. Nota opcional ("tráfico en Cetys", "salí de viaje").
5. Confirmación **ámbar** (espejo de la pantalla verde de éxito actual, tono dorado):
   "El colegio ya sabe. Tu ETA: 3:45 p.m. — puedes actualizarla."
   Con accesos: **Actualizar ETA** y **Cancelar aviso**.

Tracker existente: si hay retraso activo, banner dorado "Aviso de retraso enviado ·
llegas ~3:45" bajo el pase QR (coherencia en tiempo real vía snapshot polling).

## 5. Fase B — Admin Dashboard como consola de alertas

- **Banner global** (encima de todo, persistente en ambas pestañas):
  `⏱ 2 retrasos activos · Diego Ruiz llega ~3:45` — click abre la pestaña nueva.
  Si alguno `overdue`: banner **rojo** (`danger`), cuenta "fuera de horario: N".
- **Tercera pestaña: `Retrasos · N`** junto a Recogidas/Movimientos.
  Tarjetas (no tabla — son pocas y vivas), ordenadas por ETA ascendente:
  - Avatar(s) hijo(s) + quién recoge (relación) + nota del padre.
  - **Chip ETA** con cuenta regresiva, tabular-nums, tono por estado:
    dentro de ETA = `gold`, overdue = `danger` ("12 min sobre lo acordado"),
    arrived = `forest` ("en el kiosco"), resolved = apagada.
  - Acciones grandes: **"Marcar llegó"** (→ arrived sin kiosco) y **"Cancelar"**.
  - Toca tarjeta → timeline de sus eventos (`late_*` + trip enlazado) — reutiliza
    `eventsForRequest`/patrón de `Movimientos`.
- `toCsv`/export: columna estado de retraso sobre las filas del día (menor, fase B2).

## 6. Fase C — Tablet docente: **chip pasivo** (recomendado)

**Problema**: ¿dónde lo ve el maestro sin romper el tablero de despacho?

**Opción A (recomendada)**: en el header del tablero, junto a `Entregado · N`:
chip `⏱ Tardes · 2`. Toca → hoja (bottom-sheet) **informativa de solo lectura**:
lista simple — "Sofía M. · lo trae la abuela ~3:45 · en espera" con el mismo
componente de tarjeta compacta. Sin acciones: el maestro no gestiona, solo sabe
(que no espere a X en el pasillo / que X está en la oficina de tarde).
- Cero ruido en el caos; cero botones nuevos en la grilla de despacho.
- Consistente con la regla: docentes no administran excepciones, la oficina sí.

**Opción B (alternativa si la escuela lo pide)**: mini-sección "En oficina" bajo
las dos columnas con los alumnos en retraso, con un solo botón "Entregado" (por
si salen por oficina en vez del line). Peor para el flujo caótico; se deja como
config futuro.

La decisión de **dónde aparece lo visual (fases)**: Fase B (oficina) primero,
Fase C (chip docente) después, exactamente por ese orden de criticidad.

## 7. Reglas visuales (mismo lenguaje del producto)

| Semántica | Token | Ya se usa en |
|---|---|---|
| Espera / pendientE | `gold` (`bg-gold/10`, `text-gold-deep`) | Esperando, Simular llegadas |
| Progreso / ok | `forest` | Notificados, Éxito kiosco |
| Fuera de horario | `danger` (#8f3a32) | Botones de riesgo |
| Resuelto | neutro `muted`, opacidad baja | Entregado colapsado |

- Cuentas regresivas/etiquetas con `tabular-nums`; refresh natural del poll de 2s.
- Iconos lucide: `AlarmClock`/`Timer` (retraso), `CheckCircle2` (resuelto).
- La hoja docente reutiliza `CarImage`/avatar y radios del tablero; la pestaña
  Admin Dashboard reutiliza `SummaryCard`, `FilterPill`, `DeliveredSheet` existentes.

## 8. Orden de fases (build)

| Fase | Contenido | Superficies | Estado |
|---|---|---|---|
| A | Modelo + store + API + eventos + seed | `types.ts`, `memory-store.ts`, `store/index.ts`, seed, `api/late*` | ✅ |
| B | Padre "Llegaré tarde" completo + banner tracker | `/familia` | ✅ |
| C | Admin Dashboard: banner + sección Retrasos + cancelación oficina | `/admin` | ✅ |
| D | Kiosco→retraso auto-enlace + resolución al entregar | `arriveByCode`, `deliverTrip`, `complete` | ✅ |
| E | Chip + hoja "Tardes" en tablet docente | `/personal` | ✅ |
| F | Pulido: overdue escalado en banner, CSV con retrasos, seed demo | todas | ✅ |

Cada fase: `npm run lint` + `npx tsc --noEmit` + smoke por API + reset de demo.

## 9. Verificación por fase

- A: `POST /api/late` crea; `GET /api/state` lo muestra; eventos registrados.
- B: flujo padre end-to-end crea aviso visible en estado; actualizar/cancelar.
- C: banner y pestaña reaccionan en <2s (poll); "Marcar llegó" y "Cancelar" OK.
- D: escanear en kiosco al guardian con aviso activo → `arrived` + link; entregar
  alumnos → `resolved` (todo con sus eventos).
- E: chip refleja count en vivo; hoja de solo lectura.
- F: cambiar `etaAt` al pasado +16min → banner rojo.

## 10. Preguntas abiertas para el colegio

1. ¿Quién puede ver/gestionar retrasos: solo coordinación o también recepción?
2. ¿Tolerancia antes de "rojo" es 15 min, o la escuela tiene política propia?
3. ¿El alumno en retraso espera en oficina fija o se puede traer al line igualmente?
4. ¿Quieren registro de **retrasos históricos por familia** (reporte mensual)?
   → natural para el Fase 2 admin (no en este plan).
5. ¿Notificación SMS/WhatsApp a la persona designada cuando "marcan llegó"?
   (hoy solo compartir link manual — fuera de alcance, se anota).
