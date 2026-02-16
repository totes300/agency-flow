# Production Readiness Code Review — Agency Flow

**Date:** 2026-02-16
**Reviewed by:** 10 parallel agents covering backend, components, hooks, routing, accessibility, TypeScript, security, performance, error handling, and config.

## Executive Summary

**Totals: 19 Critical, 32 Warnings, 30+ Suggestions**

---

## CRITICAL Issues (Must Fix Before Production)

### Security & Authorization

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| S1 | `projects.listAll` leaks billing rates to team members | `convex/projects.ts:31-53` | Returns `...project` spread including `hourlyRate`, `overageRate`, `tmCategoryRates` to all authenticated users. Violates security rule #5. |
| S2 | `projects.get` leaks billing rates | `convex/projects.ts:58-193` | Same spread issue — `hourlyRate` and `overageRate` reach team members despite partial gating of `internalCostRate`. |
| S3 | `projects.listAllWithMetrics` no admin guard | `convex/projects.ts:449-668` | Uses `requireAuth`, not `requireAdmin`. Exposes `overageMinutes`, all project data. |
| S4 | `retainerPeriods.getUsage` leaks `overageRate` | `convex/retainerPeriods.ts:241` | Returns `overageRate` to any authenticated user. |
| S5 | `users.listAll` exposes `clerkId`, `email`, timer state | `convex/users.ts:74-81` | Returns full user documents to all authenticated users. Should return only `{ _id, name, avatarUrl }` for non-admins. |

### Performance — Full Table Scans

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| P1 | `tasks.list` does 8 full table `.collect()` calls | `convex/tasks.ts:213-333` | Scans ALL tasks (twice!), projects, clients, users, categories, comments, and time entries on every query. Will timeout as data grows. |
| P2 | `projects.listAllWithMetrics` scans every table | `convex/projects.ts:449-668` | Collects ALL projects, tasks, time entries, retainer periods, categories. Most expensive query in the codebase. |
| P3 | `clients.list` has N+1 query loop | `convex/clients.ts:48-71` | Queries time entries per task per project in a loop. With 10 clients x 30 projects x 200 tasks = 230+ queries per call. |

### Error Handling & Resilience

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| E1 | No `error.tsx` anywhere | `app/` directory | Zero error boundaries. Any component crash white-screens the entire app. |
| E2 | Invalid IDs show infinite loading skeletons | `clients/[id]/page.tsx:93`, `projects/[id]/page.tsx:65` | No distinction between "loading" and "not found" — broken URLs show skeletons forever. |
| E3 | `useUndoAction` silently cancels on navigation | `hooks/use-undo-action.ts:17-23` | Navigating away within 5s clears pending timeouts — action never commits but user expects it did. |
| E4 | `useDebouncedSave` drops last edit on unmount | `hooks/use-debounced-save.ts:11-14` | Closing task detail within 1s of last keystroke loses Tiptap description changes silently. |

### Broken Features

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| B1 | Comments "Load More" does nothing | `task-detail-comments.tsx:32-33` | `cursor` state set but never passed to `useQuery`. Pagination completely non-functional. |
| B2 | "Save as 1m" toast action always fails silently | `timer-button.tsx:53-60` | Timer already stopped before toast appears. Second `stopTimer()` call throws, caught by empty `catch {}`. |
| B3 | TiptapEditor doesn't sync external content changes | `tiptap-editor.tsx:38-102` | Opening a different task without full unmount shows stale content from the previous task. |

### Data Integrity

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| D1 | Task delete doesn't check subtask time entries | `convex/tasks.ts:738-772` | Subtasks with time entries are deleted, orphaning billing data. |
| D2 | No timer max duration guard | `convex/timer.ts:62-63` | A forgotten timer creates unbounded time entries (e.g., 72 hours). No server-side cap. |

### TypeScript

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| T1 | `Record<string, any>` used for tasks across all components | `task-list-table.tsx:44`, `task-detail-dialog.tsx:185`, `task-detail-metadata.tsx:15`, `task-indicators.tsx:15` | Zero compile-time type safety for the most critical data type. Typos become runtime bugs. |
| T2 | Backend helpers use `ctx: { db: any }` | `convex/tasks.ts:11-12,39,42,48,51,57,63` | All `stopTimer`, `hasTimeEntries`, `deleteTaskRelated` helpers lose type safety on DB operations. |

---

## WARNING Issues (Should Fix)

### Accessibility (7)

- [ ] **Task rows/cards not keyboard navigable** — `task-list-table.tsx:719-802,823-827`, `clients/page.tsx:197`, `project-card.tsx:226`. Missing `tabIndex`, `role`, `onKeyDown`. Violates CLAUDE.md constraint.
- [ ] **`opacity-0 group-hover:opacity-100` hides controls from keyboard users** — subtask reorder buttons (`task-detail-subtasks.tsx:123`), time entry actions (`time-entry-list.tsx:249`), task actions (`task-actions-menu.tsx:131`), comment delete (`task-detail-comments.tsx:94`). Fix: add `focus-within:opacity-100` globally.
- [ ] **Toast notifications lack `aria-live`** — `ui/sonner.tsx`. Sonner not configured with `role="status"`.
- [ ] **Missing `aria-label` on 10+ icon-only buttons** — time entry actions, client actions (`clients/page.tsx:221`), settings buttons (`settings/page.tsx:252`), search (`layout.tsx:56`), timer widget (`timer-indicator.tsx:55`), status/project/assignee/category selectors.
- [ ] **No skip-to-content link** in dashboard layout.
- [ ] **Tiptap editors lack `aria-label`** and `role="textbox"` — `tiptap-editor.tsx:94`, `tiptap-comment-editor.tsx:179`.
- [ ] **MentionList popup has no ARIA roles** — `tiptap-comment-editor.tsx:37-106`. Missing `role="listbox"`, `role="option"`, `aria-selected`.

### Security (3)

- [ ] **No security headers** in `next.config.ts` — missing `X-Frame-Options`, `X-Content-Type-Options`, CSP, HSTS.
- [ ] **File upload MIME/size validated with client-supplied values** — `convex/attachments.ts:32-64`. Server trusts what the client claims.
- [ ] **No rate limiting on any mutation** — comment spam, file upload spam, task creation possible.

### Performance (4)

- [ ] **Search input has no debounce** — `command-search.tsx:75`. Every keystroke fires a new Convex subscription with 3 full table scans.
- [ ] **Each `TimerCapsule` creates its own subscription** — `timer-button.tsx:38`. 50 visible tasks = 50 identical `useQuery(api.timer.getStatus)` calls. Lift to context.
- [ ] **`useTimerTick` context re-subscribes every second** — `use-timer-tick.tsx:76-78`. `ctx` object reference changes on every tick. Fix: depend on `ctx.subscribe` not `ctx`.
- [ ] **`formatDate` creates new `Intl.DateTimeFormat` on every call** — `lib/format.ts:42-50`. No formatter cache (unlike `formatCurrency`).

### Data & Logic (5)

- [ ] **`moveToProject` doesn't check subtask time entries** — `convex/tasks.ts:779-818`. Subtasks with time entries are moved, breaking the audit chain.
- [ ] **Timer date uses server UTC, not user timezone** — `convex/timer.ts:130-131`. Timer stopped at 1 AM local time gets yesterday's date in UTC+2.
- [ ] **No validation on `estimate` field** — `convex/tasks.ts:549`. Accepts negatives, floats, huge numbers. Violates integer-minutes constraint.
- [ ] **No validation on `yearMonth` format** — `convex/retainerPeriods.ts:36-77`. Accepts `"abc"` as a valid month.
- [ ] **Archived tasks can still receive time entries** — `convex/timeEntries.ts` doesn't check `task.isArchived`.

### React Patterns (5)

- [ ] **No webhook delay handling** — "Setting up your account..." state not implemented per CLAUDE.md error principle #2. New users see broken UI.
- [ ] **`isLoadingMore` set to true then immediately false** — `tasks/page.tsx:85-96`. Loading indicator never shown.
- [ ] **`TaskDetailMetadata` estimate text doesn't re-sync** — `task-detail-metadata.tsx:30-32`. External changes not reflected.
- [ ] **Form double-submit not guarded** — `client-form-dialog.tsx:78`, `project-form-dialog.tsx:233`. No `if (submitting) return` early guard.
- [ ] **Sidebar shows "Clients" to team members** but page shows "Admin access required" — `app-sidebar.tsx:35`.

### Config (4)

- [ ] **Missing `.env.example`** — referenced in CLAUDE.md setup but doesn't exist.
- [ ] **No `test` script in `package.json`** — Vitest configured but `npm test` fails.
- [ ] **Missing `not-found.tsx`** — no custom 404 page at `app/` or `app/(dashboard)/` level.
- [ ] **`next-themes` installed but not integrated** — `.dark` CSS vars defined in `globals.css`, `ThemeProvider` never added.

### TypeScript (4)

- [ ] **`noUncheckedIndexedAccess` not enabled** — `tsconfig.json`. Array/Map access returns `T` instead of `T | undefined`.
- [ ] **`v.any()` for Tiptap JSON fields** — `convex/schema.ts:127,162,183,205`. No validation on stored content shape.
- [ ] **Non-null assertions on nullable Svix headers** — `convex/http.ts:45-47`. Missing headers pass `null` to verify.
- [ ] **Multiple `as any` casts bypass discriminated unions** — `timer-button.tsx:43-44`, `task-detail-subtasks.tsx:72`, `task-bulk-bar.tsx:73`.

---

## SUGGESTION Items (Nice to Have)

### TypeScript & Code Quality
- [ ] Create shared `EnrichedTask` type — infer from Convex return type, replace all `Record<string, any>`.
- [ ] Consolidate timer-stop logic into a single internal mutation (duplicated in 4 files: `tasks.ts`, `timer.ts`, `clients.ts`, `projects.ts`).
- [ ] Enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` in `tsconfig.json`.
- [ ] Extract duplicated constants — `STATUS_OPTIONS` (3 files), `BILLING_LABELS` (2 files), `getInitials` (4 files).
- [ ] Type Tiptap content as `JSONContent` from `@tiptap/core` instead of `any`.
- [ ] Use Convex `MutationCtx` / `QueryCtx` types instead of `{ db: any }` in helpers.

### Performance
- [ ] Lazy-load Tiptap via `next/dynamic` — saves ~100-150KB from initial bundle.
- [ ] Add `optimizePackageImports` for `radix-ui`, `date-fns` in `next.config.ts`.
- [ ] Remove unused deps — `@base-ui/react`, possibly `tippy.js`, verify `date-fns` direct usage.
- [ ] Consider list virtualization (`@tanstack/react-virtual`) if task counts exceed 200.
- [ ] Add `display: "swap"` to Inter font loading.
- [ ] Cache `Intl.DateTimeFormat` instances like `formatCurrency` already does.
- [ ] Split `TimerTickProvider` context into stable `subscribe` context and changing `now` context.

### Error Handling
- [ ] Add retry buttons to error toasts per CLAUDE.md error handling principle #1.
- [ ] Add network status indicator for Convex disconnection.
- [ ] Safer error casting: `err instanceof Error ? err.message : "Something went wrong"` (~20 locations).
- [ ] Handle task deletion mid-view in `TaskDetailDialog`.
- [ ] Add loading fallbacks to `next/dynamic` imports.

### Data Integrity
- [ ] Add `updatedAt` timestamps to tables.
- [ ] Validate currency codes against ISO 4217.
- [ ] Add `projectId` denormalization on `timeEntries` for efficient project-level queries.
- [ ] Implement 90-day notification cleanup (per CLAUDE.md data lifecycle #3).
- [ ] Create `notifications.ts` and `todayOrder.ts` query/mutation files (tables exist but have no functions).

### Config & Deployment
- [ ] Add `robots.txt` with `Disallow: /` (internal tool).
- [ ] Add `engines` field to `package.json` (`"node": ">=20.0.0"`).
- [ ] Remove default Next.js starter assets from `public/`.
- [ ] Add `"build:convex"` and `"test"` scripts.
- [ ] Add Prettier configuration for consistent formatting.
- [ ] Add pre-commit hooks (husky + lint-staged).
- [ ] Consider separate `convex/tsconfig.json` for stricter server-side settings.
- [ ] Move `Toaster` inside `ConvexClientProvider` in root layout.

### Accessibility
- [ ] Add `aria-label` to inline task creation input, add-time inputs, subtask input, edit time entry input.
- [ ] Add `role="status"` to floating timer widget.
- [ ] Add progress bar `aria-label` descriptions (`task-detail-dialog.tsx`, `burn-progress.tsx`).
- [ ] Use `<nav aria-label="Task filters">` for filter bar.

---

## Recommended Fix Order

1. **Security** (S1-S5) — Strip billing data from non-admin queries
2. **Error boundaries** (E1-E2) — Add `error.tsx` and `not-found.tsx`, fix infinite skeleton issue
3. **Broken features** (B1-B3) — Comments pagination, timer "save as 1m", Tiptap content sync
4. **Data integrity** (D1-D2) — Subtask time entry checks, timer max duration guard
5. **Critical hooks** (E3-E4) — Undo action navigation, debounced save flush on unmount
6. **TypeScript safety** (T1-T2) — `EnrichedTask` type, backend helper types
7. **Performance** (P1-P3) — Indexed queries, search debounce, timer context
8. **Accessibility** — Keyboard navigation, ARIA labels, focus management
9. **Config** — `.env.example`, security headers, test script, error pages
10. **Suggestions** — Code quality, bundle optimization, deployment hardening
