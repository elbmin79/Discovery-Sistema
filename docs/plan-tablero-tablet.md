# Plan — Tablero de salida para tablet (grid táctil)

> Sustituye el tablero de "carriles" actual por una **cuadrícula táctil pensada para el
> maestro de turno** en iPad/tablet (y teléfono). Objetivo: **cero fricción durante el
> caos de la salida**. Un toque = avanzar un niño a la siguiente sección.

## 1. Qué es

El maestro ve, en tiempo real, a los niños cuyos padres **ya escanearon su QR en el
kiosco de entrada**. Aparecen en orden de llegada. El maestro **toca el nombre una vez**
para moverlo a la siguiente sección.

Flujo del sistema (ya existe la mitad):

```
Padre escanea QR en kiosco ──► request pasa a "arrived" ──► aparece en el tablero
      (ya implementado)            (ya implementado)          (ESTE FEATURE)
```

## 2. Modelo de interacción (lo más simple posible)

Tres secciones, un solo gesto (tocar la tarjeta):

| # | Sección | Estado | Significado |
|---|---|---|---|
| 1 | **Esperando** | `arrived` | El papá ya escaneó; el niño está en fila para ser llamado |
| 2 | **Llamado** | `preparing` | El maestro tocó; van por el niño |
| 3 | **Entregado** | `delivered` | El maestro tocó de nuevo; el niño se entregó |

- **Un toque en "Esperando"** → pasa a "Llamado".
- **Un toque en "Llamado"** → pasa a "Entregado".
- **"Entregado"** es terminal y se **colapsa** (solo un contador), para que las dos
  secciones activas tengan todo el espacio.

Reglas de "caos":
- **Sin modales, sin confirmaciones.** Un toque siempre avanza.
- **Deshacer** discreto: un botón pequeño "↩" en cada tarjeta de "Llamado" (vuelve a
  Esperando). Nunca bloquea la acción principal.
- **Orden = llegada.** Dentro de cada columna, arriba = el siguiente. Se muestra un
  número de fila (1, 2, 3…) en "Esperando" para reforzar el orden.

## 3. Estados / API (cambio mínimo y contenido)

Reutilizo los estados existentes; **no agrego estados nuevos**:

- Esperando → `arrived`
- Llamado → `preparing`
- Entregado → `delivered`

Único cambio de lógica: el flujo de tablet **salta `ready`**. Hoy el avance es
`arrived → preparing → ready → delivered`; la tablet necesita
`arrived → preparing → delivered`.

Cambios:

1. `src/lib/pickup-machine.ts` — agregar `canComplete(status)` (solo `preparing`) y
   `completeStatus() = "delivered"`.
2. `src/lib/store/memory-store.ts` — `setRequestStatus` acepta `action: "complete"`:
   `preparing → delivered`, marca `deliveredAt` + `deliveredByStaffName`, y registra el
   evento `delivered` (la bitácora ya funciona con esto).
3. `src/app/api/requests/[id]/status/route.ts` — el body `action` suma `"complete"`.

Nota: la abstracción de identificación ya soporta "tag" futuro — `arriveByCode` acepta
`code` **o** `qrToken`, así que un lector de tags solo llamaría al mismo endpoint.

## 4. Cuadrícula expandible (responsiva)

CSS Grid con columnas que **se expanden/colapsan** según el tamaño:

| Viewport | Layout |
|---|---|
| **iPad landscape (≥1024px)** | 3 columnas: `Esperando` \| `Llamado` \| `Entregado` |
| **iPad portrait (768–1023px)** | 2 columnas (`Esperando` \| `Llamado`); `Entregado` colapsado en un chip de cabecera que se expande al tocarlo |
| **Teléfono (<768px)** | 1 columna con control segmentado `Esperando / Llamado / Entregado` (objetivos táctiles grandes) |

- Cada columna es **scroll independiente** (o la página completa); las tarjetas nuevas
  entran por abajo en `Esperando`.
- Altura de filas de la grilla **auto**; las tarjetas crecen con el texto.

## 5. Tarjeta de niño (componente)

Por tarjeta, en orden de prominencia:

1. **Nombre** (grande, serif) — el objetivo del toque.
2. Grado/grupo (pequeño, arriba del nombre).
3. Avatar/foto del niño (pequeño, a la izquierda).
4. Línea fina: quién recoge + vehículo (ej. "Mamá · Corolla") — para que el maestro
   confirme visualmente sin abrir nada.
5. Hora de llegada (ej. "2:31") y número de fila en "Esperando".

**Tamaño táctil mínimo ~88px de alto** por tarjeta (Apple HIG pide ≥44pt; para caos
vamos mucho más grandes). Toda la tarjeta es el botón.

## 6. Cabecera

- Marca compacta + título "Salida — {zona/turno actual}" (por ahora "Salida").
- Reloj en vivo (contexto para el maestro).
- Contadores: "Esperando N · Llamado N · Entregado N".
- Botón "Admin" (enlace a `/admin`, ya existe) y "Nueva jornada" si aplica.

## 7. Diseño / buenas prácticas aplicadas

- **Touch-first**: tarjetas botón gigantes, sin hover-dependencia, sin drag.
- **Color + posición codifican estado**: Esperando = dorado (atención), Llamado = verde
  bosque (en proceso), Entregado = neutro. El color **no** es el único diferenciador
  (texto + posición también).
- **Contraste accesible** (paleta ya existente cream/forest/gold).
- **Feedback inmediato**: actualización optimista al tocar (la respuesta del POST ya
  trae el snapshot nuevo → re-render instantáneo). Sin spinner que confunda.
- **Reduced motion**: transiciones suaves pero que respeten `prefers-reduced-motion`.
- **A11y**: tarjetas como `<button>` reales con `aria-label` (nombre + acción), foco
  visible, texto escalable.
- **Sin pantalla de login en el flujo del turno** (sesión staff ya resuelta; auto-login
  demo en el hub). El maestro nunca debe esperar por autenticación en pleno turno.

## 8. Archivos

| Archivo | Cambio |
|---|---|
| `src/lib/pickup-machine.ts` | `canComplete` / `completeStatus` |
| `src/lib/store/memory-store.ts` | `setRequestStatus` acepta `"complete"` + evento |
| `src/app/api/requests/[id]/status/route.ts` | aceptar `action: "complete"` |
| `src/components/staff/dismissal-board.tsx` | **nuevo** — la grilla |
| `src/components/staff/dismissal-app.tsx` | **nuevo** — wrapper de sesión (reusa `useSession("staff")` + `StaffLogin`) |
| `src/app/personal/page.tsx` | renderizar `DismissalApp` (reemplaza `StaffApp`) |
| `src/components/demo/demo-hub.tsx` | actualizar tarjeta "Personal" → "Tablero de salida" |

Se **retira** `staff-board.tsx` / `staff-app.tsx` (sus funciones quedan cubiertas: el
"Entregados hoy" ahora es la columna Entregado + `/admin`).

## 9. Casos borde

- **Hermanos**: el kiosco marca `arrived` a todos los requests del viaje → los hermanos
  aparecen juntos (mismo timestamp). Opcional: pequeña etiqueta "hermanos" o color de
  familia.
- **Toque doble accidental**: tap en "Llamado" lo manda a "Entregado"; el "↩" lo regresa.
- **Sin conexión / poll lento**: `useSnapshot` ya cachea y reintenta; la acción usa la
  respuesta del POST (fresca), no espera el poll de 2s.
- **Columna vacía**: estado vacío simple ("Nadie en espera").

## 10. Verificación

1. `npm run lint` + `npm run build`.
2. Flujo manual/API: `arrive` (kiosco) → aparece en Esperando → `advance` → Llamado →
   `complete` → Entregado; verificar eventos en `/api/state` y `/admin`.
3. Responsivo: probar en 1280px (landscape), 820px (iPad portrait), 390px (teléfono).
4. (Opcional) Playwright para el recorrido completo kiosco → tablero → entrega.

## 11. Abiertos para confirmar

- ¿3 secciones (Esperando / Llamado / Entregado) o solo 2 (el entregado desaparece)?
- ¿Mostrar "en camino" (padres viniendo, aún sin escanear) como tira sutil, o ignorarlo?
- ¿El maestro necesita ver/agrupar por zona (preescolar/primaria) o es un solo flujo?
