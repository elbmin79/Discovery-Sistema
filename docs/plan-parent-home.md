# Parent home, cancellation, and late notices

Status: implemented and validated.
Based on `main` at `16e5d19` (September 9, 2026).

## Goal

Parents can cancel today's planned pickup or replace it with a late notice. When
there is no active pickup, `/familia` becomes a useful home screen with clear
actions instead of opening directly into child selection.

## Current gaps

- `ParentPlanToday` exposes change-plan and late-notice actions, but no cancellation.
- `createLatePickup` rejects students with any active pickup, including an unused pass.
- `ParentHome` currently serves as the child selector; it also handles editing an
  existing plan. The new home must keep that selection flow available separately.
- Cancellation already exists in the API/store and is allowed only while all
  requests in the trip are `on_the_way` (pass ready, before kiosk arrival).

## Behavior

### Cancel today's plan

- Add a secondary **Cancelar recogida de hoy** action to the plan screen.
- Show a short confirmation naming all affected children: the current pass will
  stop working, and a new pickup can be created later. This changes today's trip
  only; saved people, vehicles, and family settings remain available.
- Reuse the cancellation endpoint and its audit events. Return to the new home,
  clear stale selection/error state, and show **Recogida de hoy cancelada**.
- Disable submission while saving; show an inline error and retain the plan if
  cancellation fails. Never restore a cancelled pass implicitly.

### "I'll be late" replaces the planned pickup

- Keep the late action available both on the plan and on the new home.
- When opened from a plan, prefill its children and compatible picker details.
  Before submission, explain **Al enviar el aviso, se cancelará tu recogida de hoy**
  and show the children whose plan will be cancelled.
- On successful submission, cancel the eligible planned trip and create the late
  notice in **one server-side mutation/persistence operation**. Validate the whole
  request first; do not issue separate client cancellation and creation calls.
- With no active plan, create the late notice directly.
- Return home with the active notice: children, picker, ETA, and actions to update
  the time or cancel the notice. Success copy distinguishes sending a notice alone
  from sending one and cancelling a plan.
- Retain cancellation and `late_announced` audit events. The notice remains a
  message for the office (`announced | cancelled`), with no new teacher action or
  automatic resolution at the kiosk.

### Default parent home

Display a greeting and today's school-local date, then these areas in order:

| Area | Content and action |
| --- | --- |
| Active late notice, when present | Children, picker, ETA; update time or cancel notice. Gold attention styling. |
| Today's pickup | **Sin recogida programada**, **¿Quién los recoge hoy?**, and primary **Crear Pick-Up**. Opens child selection, then the existing setup flow. |
| Running late | **¿Llegarás tarde?** with short explanation and **Avisar a la escuela**. With an active notice, use **Actualizar aviso** instead of encouraging a duplicate. |
| School announcements | **De la escuela**, a **Próximamente** badge, and **Los avisos de tu escuela, aquí.** No invented announcements or nonfunctional buttons. |

Keep Home/Account navigation and the authorization inbox accessible. Creating a
pickup returns to the existing plan/pass screen. Kiosk arrival continues to show
the tracker. Preserve the delivered confirmation; after dismissal, return home.
Provide all new parent copy in Spanish and English, with accessible labels and
large touch targets consistent with the existing design.

## Boundaries and edge cases

- **Before arrival only:** automatic cancellation follows the existing `canCancel`
  rule. If arrival wins a race with submission, retain the trip, create no notice,
  refresh the UI, and explain that the parent must contact the office.
- **Whole-plan cancellation:** cancelling a plan affects every child in that trip,
  including authorized friend children. If a late notice selects only some of
  them, explicitly list the whole cancellation scope before submission; the notice
  covers only the selected eligible children. Partial trip cancellation is deferred.
- **Ownership:** validate the signed-in guardian and student permissions on the
  server. Never automatically cancel another guardian's trip; explain a conflicting
  pickup and direct the parent to coordinate with that guardian or the office.
- **Duplicate/retry:** an existing overlapping late notice should be updated through
  its existing flow. Repeated submissions must not duplicate notices or audit events.
  Validation or persistence failure must leave both the trip and notice unchanged.
- **Pass validity:** cancelled QR/code/shared passes cannot reactivate the cancelled
  trip. Verify tag lookup excludes it; retain the school's existing tag-arrival flow.
- **Later pickup:** allow a parent with a late notice to create a new pickup pass.
  Keep the notice visible until explicitly cancelled or archived under existing
  day-rollover rules. Cancelling a notice does not recreate the old pickup.
- **Today:** use the existing school-local jornada rules so yesterday's plans and
  notices do not determine today's home state.

## Implementation outline

1. Add a dashboard component; keep `parent-home.tsx` as the child selector (rename
   only if it improves clarity). Adjust routing in `parent-app.tsx` for dashboard,
   selection, setup, plan, late form, and tracker.
2. Add cancellation UI/callback and visible error handling to the plan flow.
3. Update late-form prefilling and replacement disclosure. Update the late API/store
   to validate and apply cancellation plus notice creation atomically, including
   existing optimistic-concurrency retries and audit/history behavior.
4. Add ES/EN dictionary entries and the static announcements placeholder.
5. Verify store behavior and browser flows, then run lint, TypeScript, and build.
   Read the installed Next.js guides before implementation as required by AGENTS.md.

## Acceptance checks

- A ready plan can be cancelled; home appears and the old pass is unusable.
- Submitting a valid late notice from a ready plan cancels it and shows the notice
  in both the parent app and Admin Dashboard.
- Invalid ETA, permission failure, duplicate notice, or concurrent kiosk arrival
  never produces a half-applied cancellation/replacement.
- No-plan parents see all three home areas and can create a pickup or report lateness.
- Editing/cancelling a late notice works; a new pass can be created afterward.
- Sibling/friend scope, another guardian's conflicting trip, repeated submission,
  refresh, school-day rollover, ES/EN, and mobile layouts behave as specified.
- Existing plan editing, QR enlargement/sharing, authorization inbox, kiosk arrival,
  and delivered confirmation still work.

## Suggestions

- Implemented each child's dismissal time on the home screen for quick reference.
- Keep announcements below operational actions so urgent pickup tasks stay easy.
- Implemented the approved office-contact shortcut: +52 686 837 8517 (tap to call).
- Defer announcement publishing, push notifications, recurring schedule changes, and
  partial sibling cancellation to keep this first feature small.

## Implementation and validation

- Matched the approved editorial mockup in `ParentDashboard`: illustrated greeting,
  original child portraits with grades/times, full-width pickup card, late-notice
  row, and school announcements/contact. Preserved the logo, bottom navigation,
  child selection and the existing plan/tracker,
  and added school contact, dismissal times, ES/EN copy, and the announcements placeholder.
- Late creation carries the displayed trip IDs and full child cancellation scope.
  The store validates both before changing anything and emits/persists once. Existing
  history archival records the cancellation; no schema or stored snapshot changes.
- Cancellation and late-notice APIs now check the signed server session and ownership.
  The office retains permission to manage notices. Existing sessions may need to sign
  in again if their signed cookie expired.
- Day checks exclude old plans from the parent home, new-plan conflicts, and kiosk
  QR/code/tag lookup. Cancelling a late notice never restores an old pass.
- Unit coverage: atomic publication, invalid inputs, stale scope, concurrent arrival,
  guardian ownership, sibling scope, duplicate submission, pass invalidation, new
  pickup after notice, notice editing/cancellation, day rollover, friend authorization.
- Browser coverage: ES/EN home, contact link, cancellation and recreation, late creation
  with/without a plan, Admin Dashboard visibility, update/cancel, failure recovery,
  arrival race, auth rejection, and existing plan/QR/arrival/delivery behavior.
- Browser tests run against an isolated copy with memory storage on port 3105;
  production/shared data is not reset. No database migration, new environment variable,
  or post-deploy data reset is required.

Validation passed: TypeScript, ESLint, 20 unit tests, 6 targeted browser tests,
production build, and read-only `/api/state` + `/api/health` checks (HTTP 200).

Artwork sources and generation prompts: `docs/parent-home-artwork.md`.
