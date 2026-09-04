<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Contexto del proyecto (carpool)

Cuando el usuario escriba `/carpool`, lee y aplica `.opencode/skills/carpool/SKILL.md`.
Resume el contexto en máximo 3 líneas. Si incluye una tarea después del comando,
confirma tu interpretación y continúa; si no, pregunta qué quiere trabajar.
Invocar el comando solo para cargar contexto no requiere modificar código ni ejecutar tests.

Antes de modificar código, lee `.opencode/skills/carpool/SKILL.md`: contiene el contexto
completo del producto (idea, restricciones reales, superficies, arquitectura, mapa de
archivos, convenciones y buenas prácticas). Resúmelo en máximo 3 líneas y confirma la tarea.
