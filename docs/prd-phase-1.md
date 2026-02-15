# Phase 1: Foundation

## What to Build

1. **Project scaffolding** — Next.js 16, Convex, Clerk, shadcn/ui, Tailwind v4
2. **Auth integration** — Clerk + Convex wired together with JWT template and webhook-based user sync (user.created, user.updated)
3. **Schema** — Design the full Convex schema upfront (all tables from entity relationships in CLAUDE.md), even though later phases will populate them. Key schema decisions:
   - `users` table includes `timerTaskId`, `timerStartedAt` for server-side timer, and `recentProjectIds` (array of last 5)
   - `timeEntries.date` is a string (`YYYY-MM-DD`), not a timestamp
   - `todayOrder` table: per-user ordering — stores `userId` + ordered array of task IDs for the Today view
   - `workCategories` table: global admin-managed list (e.g., Design, Development, Copywriting, PM, Testing)
   - `tasks.workCategoryId` references the `workCategories` table
   - `tasks.estimate` is integer minutes (same as durations)
   - `tasks.billable` defaults to `true`
   - Rich text fields (task descriptions, comments) store Tiptap JSON
   - All list queries support cursor-based pagination (default 50 records)
4. **Role-based access helpers** — Reusable functions to check admin vs member in Convex functions
5. **App shell** — Layout with sidebar nav, header, main content area, and `Cmd+K` / `Ctrl+K` global search
6. **Global search** — Quick-switcher modal that searches across tasks, clients, and projects. Use simple string `.filter()` matching (not full-text search indexes) — sufficient for <1000 records at this team size

## Use Cases

**UC-1.1: Sign Up / Sign In**
User signs up or signs in via Clerk. Their profile (name, email, avatar, role) syncs to Convex automatically via webhook. Role comes from Clerk `publicMetadata.role`.

**UC-1.2: Navigate the App**
User sees a sidebar with navigation: Tasks, Today, Clients, Projects, My Time. Admin sees additional items: Daily Summary, Timesheets (billing), Team. "My Time" is visible to all users (Phase 5 weekly view). "Timesheets" is admin-only (Phase 6 billing). On mobile, sidebar collapses to a drawer.

**UC-1.3: Protected Routes**
Unauthenticated users are redirected to sign-in. Authenticated users land on the main Tasks page.

**UC-1.4: Global Search (Cmd+K)**
User presses `Cmd+K` (Mac) or `Ctrl+K` (Windows) from anywhere in the app to open a search modal. Typing searches across tasks, clients, and projects simultaneously. Results are grouped by type (Tasks, Clients, Projects) with max 5 results per group. Selecting a result navigates to it and closes the modal. Escape closes. Recent searches are not stored in v1.

## Acceptance Criteria

- [ ] App runs with Next.js 16 + Turbopack
- [ ] Clerk sign-up/sign-in works
- [ ] User data syncs to Convex on signup and profile update
- [ ] User role is accessible in Convex functions
- [ ] Full schema defined (all tables — even if unused until later phases)
- [ ] Schema includes server-side timer fields on users (`timerTaskId`, `timerStartedAt`)
- [ ] Schema stores time entry dates as `YYYY-MM-DD` strings
- [ ] Schema includes `todayOrder` table for per-user task ordering
- [ ] Schema includes `workCategories` table for global work categories
- [ ] Schema includes cursor-based pagination support on list queries
- [ ] Role-based helper functions work (e.g., assert admin)
- [ ] App shell renders with responsive sidebar and header
- [ ] `Cmd+K` / `Ctrl+K` opens search modal with simple string matching, results grouped by type, selecting navigates
- [ ] Admin-only nav items (Daily Summary, Timesheets, Team) hidden from team members; "My Time" visible to all
- [ ] Mobile sidebar works as collapsible drawer
