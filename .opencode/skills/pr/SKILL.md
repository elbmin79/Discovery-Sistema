---
name: pr
description: >-
  Pre-flight and ship workflow for Discovery Salida PRs. Analyzes local changes,
  runs safety checks (types, lint, tests, migrations vs Supabase, env vars),
  fixes what it can, blocks on manual Vercel/Supabase steps, then commits, pushes,
  and opens a PR when green. Use when the user invokes /pr or $pr, or asks to
  verify/publish/open a pull request for this repo.
---

# /pr — pre-flight antes de subir a GitHub

Objetivo: que un agente (Cursor, Claude Code, Codex u otro) **no rompa prod** al
abrir un PR. El incidente típico a prevenir: código nuevo en Vercel con schema/env
de Supabase desactualizado → 500 en runtime.

## Premisas

- El usuario ya tiene en local los cambios a publicar (incluye `fetch`/`pull` reciente
  si hacía falta). No re-explorar el producto: si falta contexto, lee
  `.opencode/skills/carpool/SKILL.md` solo lo necesario.
- Al invocar `/pr` (opcionalmente con título o notas: `/pr feat: …`), ejecuta el
  flujo completo abajo. **No** abras PR ni hagas `push` si hay bloqueos.
- No actualices `git config`. No hagas force-push a `main`/`master`. No commitees
  `.env*`, claves ni secretos.

## Flujo (obligatorio, en orden)

Copia y marca progreso:

```
/pr Progress:
- [ ] 1. Inventario git
- [ ] 2. Diff vs base (main)
- [ ] 3. Clasificar riesgos
- [ ] 4. Checks automáticos
- [ ] 5. Arreglos locales
- [ ] 6. Acciones MANUALES (usuario)
- [ ] 7. Commit / push / PR (solo si verde)
- [ ] 8. Informe final
```

### 1. Inventario git

En paralelo:

- `git status -sb`
- `git fetch origin` (seguro; no modifica working tree)
- `git branch -vv`
- Rama base: `origin/main` (si no existe, `origin/master`)
- `git log --oneline -8`
- `git diff` y `git diff --stat` (staged + unstaged)
- `git log --oneline origin/main..HEAD` (commits locales no en remoto)

Si la rama local está detrás de `origin/main` con riesgo de conflicto, avisa y
pregunta si merge/rebase antes de seguir. No hagas rebase interactivo.

### 2. Diff vs base

Analiza **todo** lo que irá en el PR (`origin/main...HEAD` + working tree):

```sh
git diff --stat origin/main...HEAD
git diff origin/main...HEAD --name-only
```

Incluye untracked relevantes bajo `src/`, `supabase/`, `tests/`, `docs/`,
`vercel.json`, `package.json`. Ignora `.next/`, `node_modules/`, `test-results/`.

### 3. Clasificar riesgos (según archivos tocados)

Marca cada categoría que aplique. Si aplica, ejecuta las verificaciones de esa fila.

| Señal en el diff | Riesgo | Qué verificar |
|---|---|---|
| `supabase/migrations/**` | **CRÍTICO schema** | Migraciones nuevas deben existir en prod **antes** del merge/deploy. Comparar con Supabase (MCP `list_migrations` / `list_tables` / SQL) o documentar que el usuario debe aplicarlas. |
| `src/lib/store/**`, `src/lib/types.ts`, RPC `commit_pickup_state` / `query_pickup_history` | **CRÍTICO runtime DB** | `/api/state` y mutaciones fallan con 500 si faltan tablas/RPC/bucket. |
| `storage` / `arrival-photos` / `src/lib/arrival-photos.ts` | Storage | Bucket privado `arrival-photos` en el proyecto correcto. |
| Nuevas lecturas de `process.env.*` / `vercel.json` crons | Env Vercel | Variables deben existir en Production (+ Preview). **Solo el usuario** las pega en el dashboard. |
| `package.json` / lockfile | Build | `npm ci` mental: deps nuevas; correr `npx tsc` y preferible `npm run build`. |
| `src/app/api/**` | API | Errores en español; no filtrar service role al cliente; rutas `dynamic` si leen store. |
| Auth / cookies / `SESSION_SECRET` / `CRON_SECRET` | Sesión / cron | Ver checklist env abajo. |
| Seed / snapshot shape | Datos viejos | ¿Hace falta “Nueva jornada” o `history:backfill` tras deploy? |
| Solo UI (`components/**`, CSS) sin store/API/migrations | Bajo | Checks de calidad bastan. |

**Env vars conocidas de este repo (no inventar otras sin ver el diff):**

| Variable | Dónde | Notas |
|---|---|---|
| `SUPABASE_URL` | Vercel + local | Server |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local | Público |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + local | **Nunca** `NEXT_PUBLIC_` |
| `SESSION_SECRET` | Vercel | Aleatorio estable; no reutilizar service role |
| `CRON_SECRET` | Vercel | Bearer para `/api/history/maintenance` (`vercel.json`) |

Si el diff introduce una env nueva, añádela a la sección MANUAL del informe.

### 4. Checks automáticos (siempre)

Ejecuta desde la raíz del repo (PowerShell: usa `;` no `&&` si falla):

1. `npx tsc --noEmit -p tsconfig.json`
2. `npx eslint src --max-warnings=0` (o el script `npm run lint` si es equivalente)
3. `npm test` (tests unitarios del repo)
4. Si tocaste migrations, store, history, photos o `package.json`: intenta `npm run build`
5. Si hay MCP/CLI Supabase y el diff toca migrations/schema: verifica en el proyecto
   **Discovery Salida** que existan los objetos que el código nuevo llama
   (tablas, RPCs, bucket). Si no puedes acceder, marca bloqueo MANUAL.

Si un check falla: **arregla en local**, re-ejecuta, no sigas al push.

No corras `test:e2e` / `test:storage` / `test:db` por defecto (Docker/Edge). Solo si el
usuario lo pide o el diff es específicamente de histórico/storage y el entorno lo permite.

### 5. Arreglos locales (sí puedes)

- Errores de TypeScript / ESLint introducidos por el cambio
- Imports rotos, tipos, tests rotos por el diff
- Añadir migración faltante en `supabase/migrations/` si el código asume schema nuevo
  y no hay archivo SQL
- Actualizar docs de operación solo si el usuario lo pidió o es imprescindible

### 6. Acciones MANUALES (NO las hagas tú en silencio)

**Detente y lista con pasos concretos** si hace falta:

1. **Supabase (prod):** aplicar migraciones nuevas en orden (MCP `apply_migration`,
   dashboard SQL, o CLI). Verificar tablas/RPC/bucket.
2. **Vercel → Settings → Environment Variables:** agregar/editar keys (Production + Preview).
3. **Vercel → Redeploy** tras cambiar env (guardar env no basta).
4. **Post-deploy:** “Nueva jornada” y/o `npm run history:backfill` con env del servidor
   inyectadas (el script no carga `.env` solo), según `docs/historico-operacion.md`.

No inventes valores de secretos en el chat de forma que queden en el repo. Puedes
sugerir un comando local para generarlos (p. ej. PowerShell `[Convert]::ToBase64String...`).

**Política:** si hay pendientes MANUALES de schema/env **críticos** para que prod no
reviente al merge, **no hagas push/PR** hasta que el usuario confirme “ya apliqué
migraciones / ya puse las env”. Si el cambio es solo UI y no toca DB/env, puedes
seguir.

### 7. Commit / push / PR (solo si verde)

Solo cuando checks pasan y no hay bloqueos manuales pendientes (o el usuario confirmó):

1. Confirma rama: si estás en `main` con trabajo propio, crea
   `feat/…` o `fix/…` antes de commit (no subas basura directo a main salvo que el
   usuario lo pida explícitamente).
2. `git add` solo archivos del cambio (no `.env`, no `.next`).
3. Commit con mensaje claro (español o inglés; estilo del repo: oración completa
   centrada en el *porqué*). En PowerShell no uses heredoc bash; usa
   `git commit -F archivo.txt` o `-m` simple.
4. `git push -u origin HEAD`
5. Abrir PR con `gh pr create` si `gh` está disponible; si no, da la URL
   `https://github.com/<org>/<repo>/pull/new/<branch>` y el cuerpo sugerido.

Cuerpo del PR (plantilla):

```markdown
## Summary
- …

## Risk / release notes
- [ ] Sin cambios de schema/env
- [ ] Migraciones aplicadas en Supabase prod: … (o N/A)
- [ ] Env Vercel: … (o N/A)
- [ ] Post-deploy: Nueva jornada / backfill: … (o N/A)

## Test plan
- [ ] tsc / eslint / npm test
- [ ] Smoke rutas tocadas (/familia, /personal, /admin, …)
```

### 8. Informe final al usuario

Formato fijo, breve:

```markdown
## /pr resultado: LISTO | BLOQUEADO

### Cambios analizados
- … (1–5 bullets)

### Checks
- tsc: OK/FAIL
- eslint: OK/FAIL
- tests: OK/FAIL
- build: OK/FAIL/SKIP
- schema Supabase: OK/FAIL/SKIP

### Manual (tú)
1. … (o “Ninguno”)

### GitHub
- rama: …
- PR: url o “no creado — motivo”
```

## Anti-patrones

- No asumas que “si compila en local, Vercel está bien” cuando hay migrations/env.
- No aplicas migraciones a prod sin decirle al usuario (salvo que `/pr` + usuario
  pidieron explícitamente aplicarlas en esta sesión y tienes MCP/credenciales).
- No abras PR a medias con checks en rojo “para que CI avise”.
- No mezcles trabajo no relacionado en el mismo PR.

## Referencias del repo

- Operación histórico / migraciones / env: `docs/historico-operacion.md`
- Contexto producto: `.opencode/skills/carpool/SKILL.md`
- Store dual y `commit_pickup_state`: `src/lib/store/index.ts`
- Crons: `vercel.json`
