# Release (promote-only production)

Discovery ships on Vercel. Merges to `main` must **not** go live by themselves.

## Flow

1. Open a **draft** PR → QA (familia surfaces when relevant) → pr architect `/pr` → merge to `main`.
2. Vercel builds `main` as a **staged** production deployment (ready, not serving the custom domain).
3. When you want parents to see it: in Vercel → Deployments → open that `main` deployment → **Promote**.
4. Cut the version tag: `npm run release -- patch` (or `minor` / `major`).

PR previews stay automatic. Rollback: Vercel → Deployments → previous production → Rollback.

## One-time Vercel setting

Project → Settings → Environments → Production → Branch Tracking → turn **off**  
**Auto-assign Custom Production Domains**  
(API field: `autoAssignCustomDomains: false`).

## One-time GitHub setting (repo admin)

Protect `main`: require a pull request before merge (no direct push). Optional: require the `/pr` check / review from pr architect.

## Versioning

- Source of truth: `package.json` `"version"`.
- Each promote gets a GitHub Release `vX.Y.Z` via `npm run release`.
- Do not bump version on every PR — only when promoting to live.
