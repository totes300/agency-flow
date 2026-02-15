# CLAUDE.md

# CLAUDE.md — Agency Flow by Konverted

## What This Is

Internal tool for a small web agency (2–5 people) to manage client work, track time against budgets, and produce monthly timesheets for billing.

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16.x | App Router, Turbopack |
| Backend/DB | Convex | Realtime reactive DB, server functions |
| Auth | Clerk | @clerk/nextjs v6.x, JWT template for Convex |
| UI | shadcn/ui + Tailwind v4 | |
| Rich Text | Tiptap | StarterKit + TaskList + TaskItem |
| Drag & Drop | @dnd-kit | core + sortable |

## Hard Constraints

These are things that WILL go wrong if not explicitly stated:

1. **No Next.js API routes** — ALL data operations through Convex functions. Zero `/app/api/` routes.
2. **Next.js 16 middleware is `proxy.ts`**, not `middleware.ts`.
3. **Durations stored as integer minutes** — never floats, never hours. Timer durations round UP to the nearest minute.
4. **Estimates stored as integer minutes** — same as durations. Displayed as hours (e.g., "2h 30m").
5. **Retainer status is a string enum** (`"active"`, `"inactive"`) not boolean — needs future extensibility for `"paused_billing"`, `"cancelled"`.
6. **Subtasks are 1 level deep only** — no nesting.
7. **Subtasks don't appear in the main task list** — only inside parent task detail (exception: Today view shows subtasks marked "Today").
8. **Completing all subtasks does NOT auto-complete the parent.**
9. **Time entries always chain: time → task → project → client.** No orphan time. Neither the timer nor the Add Time component can be used on a task without a project — prompt user to assign one first.
10. **Currency is per-client** — no conversion, just display in the client's currency.
11. **Timer state is server-side** — The `users` table stores `timerTaskId` and `timerStartedAt`. The UI renders elapsed time by diffing `Date.now()` against the stored start timestamp. No client-side intervals for tracking. Timer survives browser closes and device switches.
12. **Time entry dates are calendar date strings** (`YYYY-MM-DD`), not UTC timestamps. The date represents the calendar day the user chose, not a UTC conversion. Timer started before midnight and stopped after uses the stop date.
13. **Rich text stored as Tiptap JSON** — the native Tiptap document format. Stored as a JSON object in Convex, not HTML or Markdown.
14. **Rich text auto-save is debounced** — save 1 second after last keystroke, not on every change.
15. **Client currency is locked** after the first project is created under that client.
16. **Timesheets are snapshots** — Draft timesheets store a `generatedAt` timestamp and recompute on regenerate. Sent/Paid timesheets store a denormalized JSON blob of all computed data so they are truly frozen.
17. **Undo toast pattern** — "Toast with undo" means a 5-second delayed mutation. The destructive action is NOT committed until the toast auto-dismisses. Clicking Undo cancels the pending mutation entirely.
18. **Work categories are global** — a `workCategories` table managed by admins (e.g., Design, Development, Copywriting, PM, Testing). These are used on tasks and on Fixed project category breakdowns.
19. **Billable flag defaults to `true`** — on new tasks. Team members and admins can both toggle it.
20. **Comments use Tiptap with Mention extension** — `@mentions` are stored as Tiptap mention nodes containing the user's Convex ID. The mention node triggers a notification write on comment save.
21. **All list queries use cursor-based pagination** — default 50 records with "load more." Applies to: task list, time entries, activity log, notifications, comments.
22. **File uploads max 10 MB per file, max 20 files per task.**
23. **Retainer rollover is fixed at 3 months** — hardcoded for v1. No per-retainer configuration.
24. **Retainer hours used is always computed** from time entries (single source of truth), never cached on the period record.
25. **Retainer periods use lazy creation** — created on first access (logging time or viewing retainer detail), not via cron.
26. **Team members see only tasks assigned to them** — not "projects they're a member of." No project membership concept.
27. **Moving a task to a different project is blocked** if any time entries exist on it. Admin sees a warning explaining why.
28. **Use shadcn/ui components — never create custom UI components from scratch.** Before building any UI element, search the shadcn registry (via the shadcn MCP server: `search_items_in_registries`, `view_items_in_registries`, `get_item_examples_from_registries`) for an existing component. Use `get_add_command_for_items` to install it. Only extend or compose shadcn primitives if no direct match exists. Do not hand-roll buttons, dialogs, dropdowns, inputs, tables, toasts, popovers, or any other standard UI pattern.



## Entity Relationships

```
clients 1:N projects
projects 1:N tasks
tasks 1:N tasks (parent → children, 1 level only)
tasks 1:N timeEntries
tasks 1:N comments (stored as Tiptap JSON with mention nodes)
tasks 1:N attachments (Convex file storage, max 10MB/file, 20/task)
tasks 1:N activityLogEntries
users 1:N timeEntries
users 1:N notifications
users — timerTaskId + timerStartedAt (server-side timer state)
users — recentProjectIds (array of last 5 project IDs, per-user)
clients 1:N timesheets
projects(retainer) 1:N retainerPeriods (monthly usage, lazy-created)
projects(fixed) 1:N projectCategoryEstimates (per-category hours + rates)
workCategories — global admin-managed list (Design, Dev, Copywriting, PM, Testing, etc.)
todayOrder — per-user task ordering (userId + ordered array of taskIds)
```

## Roles

Two roles only, stored in Clerk `publicMetadata.role`:
- **Admin**: Full access — billing, rates, timesheets, review queue
- **Team Member**: See/manage assigned tasks, log time. Cannot see billing data, rates, or timesheets.

## Feature Specs

Full specs in `/docs/`:
- `prd-master.md` — Data model, feature overview, implementation phases
- `prd-phase-1.md` through `prd-phase-7.md` — Per-phase use cases and acceptance criteria

## Error Handling Principles

These rules apply to every phase:

1. **Mutation failures** — show a toast with the error message and a Retry button. The UI should revert optimistic updates on failure. For 5-second delayed mutations (undo pattern), if the network drops during the delay, the action does NOT commit — treat network failure as implicit undo.
2. **Webhook failures** — Clerk retries webhook delivery with exponential backoff. If a user signs in but their record hasn't synced to Convex yet (webhook delay), the app should show a brief "Setting up your account..." loading state and poll for the user record, rather than erroring.
3. **File upload failures** — validate file size (10 MB) and type (images, PDFs, docs only) client-side BEFORE uploading. Show a clear validation error. On upload failure, show a toast with Retry.
4. **Timer stop uses server timestamp** — when stopping a timer, the Convex mutation calculates duration from `Date.now()` on the server, not from the client. This prevents device clock drift from creating inaccurate entries.
5. **Concurrent timesheet generation** — if two admins generate a timesheet for the same client/month, the system should return the existing Draft rather than creating a duplicate. Enforce uniqueness on (clientId + period).
6. **Convex function timeouts** — timesheet generation (Phase 6) and cascading archive (Phase 2) may involve many records. If a function approaches Convex's execution limit, it should fail gracefully with a clear error rather than silently truncating. Test with realistic data volumes.



## Formatting & Localization

1. **Currency formatting** — use `Intl.NumberFormat` with the client's currency code. This handles locale-appropriate decimal separators, thousands separators, and symbol placement (e.g., €1.234,56 vs $1,234.56 vs 1 234 567 Ft).
2. **Date display** — use `Intl.DateTimeFormat` with the user's browser locale. Stored as `YYYY-MM-DD`, displayed in the user's local format (e.g., 2025.03.15 for Hungarian locale, 15/03/2025 for UK, 03/15/2025 for US).
3. **Duration display** — always displayed as `Xh Ym` (e.g., "2h 30m", "45m", "8h"). Never as decimal hours or raw minutes.
4. **CSV export encoding** — UTF-8 with BOM (Byte Order Mark) for Excel compatibility with Hungarian characters (á, é, í, ö, ü, ő, ű).
5. **Week start** — Monday (ISO 8601). Used in the weekly timesheet view.
6. **Language** — English only for v1. No i18n framework needed.

## Accessibility

1. **All interactive elements must be keyboard-navigable.** Tab through task list rows, Enter to open detail, Escape to close overlays/modals.
2. **Drag-and-drop must have a keyboard alternative.** @dnd-kit supports keyboard DnD — configure it for both the Today view and subtask reordering. Users should be able to reorder with arrow keys + Enter.
3. **Status pills must not rely on color alone.** Always include the text label inside the pill. Color is supplementary.
4. **Use shadcn/ui's built-in ARIA support.** Dropdowns, modals, popovers, and toasts from shadcn/ui include ARIA roles by default — do not override them.
5. **Toast notifications must be announced.** Use `role="status"` or `aria-live="polite"` so screen readers pick up toast messages.
6. **Focus management.** When opening a modal/overlay, focus moves to the first interactive element inside it. When closing, focus returns to the trigger element.

## Security

1. **Clerk webhook verification** — all incoming webhooks must verify the Svix signature using Clerk's signing secret. Reject unsigned or invalid payloads.
2. **File upload validation** — validate MIME type server-side (accept: image/*, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.*). Reject executables and scripts regardless of extension.
3. **Tiptap JSON validation** — validate that stored Tiptap JSON conforms to the expected document schema before rendering. Tiptap sanitizes by default, but do not render raw HTML from user input.
4. **Role enforcement at the function level** — every Convex query and mutation must check the user's role independently. Never rely on client-side route hiding for security. The Phase 7 permission audit (UC-7.5) verifies this.
5. **No sensitive data in client-side state** — billing rates, internal cost rates, and profitability data must never be fetched in queries accessible to team members, even if the UI doesn't display them.

## Data Lifecycle

1. **Archived records** — retained indefinitely for v1. Archived clients, projects, and tasks remain in the database but are excluded from queries by default (filtered by `isArchived` flag). Revisit retention policy post-launch if data volume becomes a concern.
2. **Activity log retention** — no auto-expiry for v1. If the activity log grows large, cursor-based pagination (Constraint #21) keeps query performance acceptable.
3. **Notification retention** — notifications older than 90 days should be auto-deleted via a Convex scheduled function (added in Phase 7). This prevents unbounded growth.
4. **File storage** — monitor Convex file storage usage. No auto-cleanup for v1. Files on archived tasks are retained.
5. **User departure (GDPR)** — when a team member leaves the agency, their Clerk account is deactivated. Their data in Convex is anonymized: display name replaced with "Former Team Member", email removed, avatar removed. Their time entries, activity log entries, and comments remain attributed to the anonymized identity for billing audit integrity. Mention nodes in comments are updated to reference the anonymized user. This is a manual admin process for v1.
6. **Timesheet data** — Sent/Paid timesheets with denormalized JSON blobs are retained indefinitely (7+ years for tax/audit purposes in most jurisdictions).

## Deployment

1. **Hosting** — Next.js app deployed on Vercel. Convex is a managed service (no self-hosting).
2. **Environments** — two Convex deployments: `dev` (local development + staging) and `prod` (production). Vercel preview deployments use the `dev` Convex instance; production deployments use `prod`.
3. **CI/CD** — Vercel auto-deploys on push to `main` (production) and on pull requests (preview). Convex schema is deployed via `npx convex deploy` as part of the build step.
4. **Secrets** — Clerk API keys, Convex deployment URL, and webhook signing secrets stored in Vercel environment variables. Never committed to the repository.
5. **Schema changes** — Convex schema changes should be backward-compatible. If a breaking change is needed, write a migration function and test it against the dev deployment before applying to prod.
6. **Rollback** — Vercel supports instant rollback to previous deployments. Convex function rollback requires redeploying the previous version. For billing-critical changes (Phase 6), test on dev deployment with realistic data before promoting to prod.
