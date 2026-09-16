<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Language (cost rule)

- **Agent ↔ human** (chat, reviews, status, commits, PR bodies): **English only.** Do not summarize or reply in Spanish.
- **App / user-facing code:** **Spanish-first.** UI copy, staff surfaces, and store errors stay Spanish. `/familia` may keep ES/EN dictionaries; staff = Spanish.

# Project context (carpool)

When the user writes `/carpool`, read and apply `.opencode/skills/carpool/SKILL.md`.
Summarize the context in at most three **English** lines. If the invocation includes a task,
confirm your understanding and proceed; otherwise, ask what they want to work on.
Loading context alone does not require code changes or running tests.

Before modifying code, read `.opencode/skills/carpool/SKILL.md`: it has the full product
context (idea, real constraints, surfaces, architecture, file map, conventions, and best
practices). Summarize in at most three English lines and confirm the task.

# Pre-flight of PR (/pr)

When the user writes `/pr` (or asks to verify/open a pull request / push changes
with prod checks), read and apply `.opencode/skills/pr/SKILL.md`. Analyze the local
diff vs `main`, run verifications, fix what is automatic, **stop** if manual action
is needed in Supabase or Vercel, and only then commit/push/PR.
