# Phase 3: Task Management — Implementation Plan

## Context
Phase 1 (Foundation) and Phase 2 (Core Data) are complete. The app has auth, clients, projects (all 3 billing types), work categories, and retainer periods. The tasks page is a stub. Phase 3 builds the main task list — the primary daily workspace — with inline editing, filtering, grouping, hover popovers, and bulk actions.

This is the most UI-heavy phase. It's broken into 14 subtasks (~15–30 min each), designed to run in separate Claude Code sessions. Each subtask is a committable chunk.

---

## ASCII Wireframes

### Task List Table Row (Desktop)
```
┌──┬────────────────────────────────────────┬───────────────────┬──────────┬──────────┬──────────┬────────┬───┐
│☐ │ Task title here          📝 💬3 ☑2/5   │ Acme → Website    │ 🟡🟢🔴  │ Today    │ Design   │ 2h 30m │ ⋯ │
│  │                                        │ (client→project)  │ avatars  │ (pill)   │ (label)  │  ▶     │   │
└──┴────────────────────────────────────────┴───────────────────┴──────────┴──────────┴──────────┴────────┴───┘
 │     │           │    │    │                    │                  │           │            │          │
 │     │           │    │    └─ subtask indicator  │                  │           │            │          └─ overflow menu
 │     │           │    └─ comment count           │                  │           │            └─ logged time + play btn
 │     │           └─ has-description icon          │                  │           └─ work category dropdown
 │     └─ click to open task detail                 │                  └─ status pill dropdown
 │                                                  └─ project chip (click → selector)
 └─ checkbox (visible on hover, always on mobile)

 Each cell is clickable → opens inline editor (dropdown/picker/input)
```

### Hover Popovers (appear on indicator icon hover)

**Subtask Popover:**
```
┌─────────────────────────────────┐
│ Subtasks (2/5 completed)        │
│ ─────────────────────────────── │
│ ☑ Design homepage mockup        │
│ ☑ Get client approval           │
│ ☐ Build responsive layout       │
│ ☐ Add animations                │
│                                 │
│ View all subtasks →             │
└─────────────────────────────────┘
```

**Comment Popover:**
```
┌─────────────────────────────────┐
│ 3 comments                      │
│ ─────────────────────────────── │
│ 🟡 Jane D. · 2h ago            │
│ "Updated the layout based on    │
│  client feedback from..."       │
│                                 │
│ Open comments →                 │
└─────────────────────────────────┘
```

**Description Popover:**
```
┌─────────────────────────────────┐
│ Description                     │
│ ─────────────────────────────── │
│ Build the responsive homepage   │
│ layout following the approved   │
│ Figma mockups. Key sections:    │
│ hero, features, pricing...      │
│                                 │
│ View full description →         │
└─────────────────────────────────┘
```

### Mobile Card Layout
```
┌─────────────────────────────────────┐
│ ☐  Task title here       📝 💬3 ☑2/5│
│    Acme → Website Redesign          │
│    ┌──────┐  🟡🟢  Design   2h 30m │
│    │Today │                         │
│    └──────┘                    ⋯    │
└─────────────────────────────────────┘
```

### Filter Bar (Desktop)
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [Client ▾]  [Project ▾]  [Assignee ▾]  [Status ▾]  [Date range]   Group: [▾]   │
│                                                                                  │
│ Active filters: [Acme ×] [Today ×] [Jane ×]                      Clear all      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Filter Drawer (Mobile)
```
┌─────────────────────────────┐
│ Filters                   ✕ │
│ ─────────────────────────── │
│ Client                      │
│ [Select client...        ▾] │
│                             │
│ Project                     │
│ [Select project...       ▾] │
│                             │
│ Assignee                    │
│ [Select person...        ▾] │
│                             │
│ Status                      │
│ [Select status...        ▾] │
│                             │
│ Date Range                  │
│ [From] — [To]               │
│                             │
│ [Apply Filters]  [Clear]    │
└─────────────────────────────┘
```

### Bulk Action Floating Bar
```
                    ┌─────────────────────────────────────────────────────────────┐
                    │  3 selected   [Status ▾]  [Assignee ▾]  [Archive]    ✕     │
                    └─────────────────────────────────────────────────────────────┘
 (fixed to bottom of viewport, appears when ≥1 task selected)
```

### Project Selector Popover (inline on task row)
```
┌────────────────────────────────┐
│ 🔍 Search projects...          │
│ ──────────────────────────────  │
│ ★ Recently Used                 │
│   Acme → Website  [Retainer]   │
│   BigCo → App     [T&M]       │
│ ──────────────────────────────  │
│ Acme Corp                       │
│   Website Redesign  [Retainer] │
│   Brand Guide       [Fixed]   │
│ BigCo Inc                       │
│   Mobile App        [T&M]     │
│   Dashboard         [Fixed]   │
└────────────────────────────────┘
```

---

## Convex Functions Needed

### File: `convex/tasks.ts`

#### Queries

**`tasks.list`** — Main task list query
```typescript
args: {
  paginationOpts: paginationOptsValidator,  // cursor-based, default 50
  filters?: {
    clientId?: Id<"clients">,
    projectId?: Id<"projects">,
    assigneeId?: Id<"users">,
    status?: TaskStatus,
    dateFrom?: string,   // YYYY-MM-DD (by _creationTime)
    dateTo?: string,
  },
  groupBy?: "none" | "client" | "project" | "assignee" | "status",
  includeArchived?: boolean,
}
returns: PaginationResult<{
  _id, _creationTime, title, status, projectId, assigneeIds, workCategoryId,
  estimate, billable, isArchived, parentTaskId,
  // Enriched:
  projectName, clientName, clientId, projectBillingType,
  assignees: { _id, name, avatarUrl }[],
  workCategoryName,
  totalMinutes,        // sum of time entries
  subtaskCount,        // total subtasks
  completedSubtaskCount,
  commentCount,
  hasDescription,      // boolean
  latestComment?: { userName, avatarUrl, content (truncated text), _creationTime },
  subtaskPreview?: { _id, title, status }[],  // first 5
  descriptionPreview?: string,  // first ~200 chars plain text
}>
```
**Permissions:** Admin sees all non-subtask tasks. Member sees only tasks where their ID is in `assigneeIds`. Subtasks (`parentTaskId != null`) are excluded from main list (constraint #7).

**`tasks.get`** — Single task detail (Phase 4 will expand this)
```typescript
args: { id: Id<"tasks"> }
returns: full task with project, client, assignees, work category
```
**Permissions:** Admin can view any. Member can view only if assigned.

**`tasks.getAutoAssignSuggestion`** — Check default assignee for work category
```typescript
args: { projectId: Id<"projects">, workCategoryId: Id<"workCategories"> }
returns: { suggestedUserId?: Id<"users">, userName?: string } | null
```
**Permissions:** Any authenticated user.

#### Mutations

**`tasks.create`** — Inline creation
```typescript
args: {
  title: v.string(),
  projectId?: Id<"projects">,
  status?: TaskStatus,         // defaults "inbox"
  assigneeIds?: Id<"users">[],  // defaults []
  parentTaskId?: Id<"tasks">,
}
returns: Id<"tasks">
```
**Permissions:** Any authenticated user. If parentTaskId is set, inherits parent's project.

**`tasks.update`** — General field update (inline edits)
```typescript
args: {
  id: Id<"tasks">,
  title?: string,
  projectId?: Id<"projects">,
  assigneeIds?: Id<"users">[],
  workCategoryId?: Id<"workCategories"> | null,  // null to clear
  estimate?: number | null,
  billable?: boolean,
}
returns: void
```
**Permissions:** Admin can update any. Member can update only if assigned. Validates: if projectId changes, blocked if time entries exist (constraint #27). Updates `recentProjectIds` on user when project changes.

**`tasks.updateStatus`** — Status change with permission check
```typescript
args: { id: Id<"tasks">, status: TaskStatus }
returns: void
```
**Permissions:** Admin can set any status. Member cannot set "done" — throws error.

**`tasks.duplicate`** — Copy task
```typescript
args: { id: Id<"tasks"> }
returns: Id<"tasks">
```
Copies: title, description, assigneeIds, projectId, estimate, workCategoryId, billable. Sets status="inbox", isArchived=false. Does NOT copy: time entries, subtasks, attachments, comments, activity log.
**Permissions:** Any authenticated user (must be able to see original task).

**`tasks.archive`** — Soft archive
```typescript
args: { id: Id<"tasks"> }
returns: void
```
Sets `isArchived = true`. Also archives all subtasks. Auto-stops any running timers on this task.
**Permissions:** Any authenticated user who can see the task.

**`tasks.remove`** — Hard delete
```typescript
args: { id: Id<"tasks"> }
returns: void
```
Blocked if time entries exist. Deletes: task + subtasks + comments + attachments + activity log.
**Permissions:** Admin only.

**`tasks.moveToProject`** — Change project
```typescript
args: { id: Id<"tasks">, projectId: Id<"projects"> }
returns: void
```
Blocked if any time entries exist on this task (constraint #27). Updates task's projectId and clears workCategoryId (since categories may differ). Also moves subtasks.
**Permissions:** Admin only (since it affects billing chain).

**`tasks.bulkUpdateStatus`** — Bulk status change
```typescript
args: { ids: Id<"tasks">[] (max 50), status: TaskStatus }
returns: { updated: number }
```
**Permissions:** Admin can set any status. Member cannot set "done". Skips tasks the user cannot access.

**`tasks.bulkUpdateAssignees`** — Bulk assignee change
```typescript
args: { ids: Id<"tasks">[] (max 50), assigneeIds: Id<"users">[] }
returns: { updated: number }
```
**Permissions:** Admin can update any. Member can only update tasks they're assigned to.

**`tasks.bulkArchive`** — Bulk archive
```typescript
args: { ids: Id<"tasks">[] (max 50) }
returns: { archived: number }
```
**Permissions:** Same as single archive. Auto-stops timers.

### File: `convex/users.ts` (additions)

**`users.updateRecentProjects`** — Update recently used projects
```typescript
args: { projectId: Id<"projects"> }
returns: void
```
Pushes projectId to front of `recentProjectIds`, deduplicates, caps at 5.

**`users.listAll`** — List all users (for people picker)
```typescript
args: {}
returns: { _id, name, avatarUrl, role }[]
```
**Permissions:** Any authenticated user.

---

## Subtasks (Execution Order)

### Subtask 3.0: Install missing shadcn components ✅
**Files:** `components/ui/` (new files from shadcn CLI)
**Depends on:** Nothing
**What:** Install shadcn components needed for Phase 3: `checkbox`, `popover`, `calendar`, `date-picker` (if available), `hover-card`. Search the shadcn registry first.
**Verify:** Run `ls components/ui/` and confirm new files exist. `npm run build` passes.
**Commit message:** `feat(phase-3): install shadcn checkbox, popover, hover-card, calendar`

---

### Subtask 3.1: Task CRUD backend — core mutations ✅
**Files created:** `convex/tasks.ts`
**Files modified:** `convex/users.ts` (add `listAll` query, `updateRecentProjects` mutation)
**Depends on:** Nothing
**What:**
- `tasks.create` mutation (inline creation, defaults: status=inbox, billable=true, assigneeIds=[], isArchived=false)
- `tasks.update` mutation (general field update with project-move blocking)
- `tasks.updateStatus` mutation (admin-only "done" check)
- `tasks.get` query (single task with enrichment)
- `users.listAll` query
- `users.updateRecentProjects` mutation
**Verify:** Write and run Vitest tests. All pass.
**Commit message:** `feat(phase-3): task CRUD backend + user helpers`

---

### Subtask 3.2: Task list query backend ✅
**Files modified:** `convex/tasks.ts`
**Depends on:** 3.1
**What:**
- `tasks.list` query with pagination (cursor-based, 50/page)
- Role scoping (admin=all, member=assigned only)
- Filter support (clientId, projectId, assigneeId, status, date range)
- Exclude subtasks from main list (parentTaskId == undefined)
- Exclude archived by default
- Enrichment: project/client names, assignee details, totalMinutes, subtaskCount, commentCount, hasDescription, latestComment, subtaskPreview, descriptionPreview
- `tasks.getAutoAssignSuggestion` query
**Verify:** Write and run Vitest tests. Confirm pagination, role scoping, and filters work.
**Commit message:** `feat(phase-3): task list query with pagination, filters, enrichment`

---

### Subtask 3.3: Task actions backend — duplicate, archive, delete, move ✅
**Files modified:** `convex/tasks.ts`
**Depends on:** 3.1
**What:**
- `tasks.duplicate` — copies correct fields, status=inbox
- `tasks.archive` — cascade to subtasks, auto-stop timers
- `tasks.remove` — hard delete (admin only), blocked if time entries exist
- `tasks.moveToProject` — blocked if time entries, clears workCategoryId
**Verify:** Vitest tests for each action including edge cases (time entry blocking, timer auto-stop).
**Commit message:** `feat(phase-3): task actions — duplicate, archive, delete, move`

---

### Subtask 3.4: Bulk actions backend ✅
**Files modified:** `convex/tasks.ts`
**Depends on:** 3.1
**What:**
- `tasks.bulkUpdateStatus` — max 50, permission checks per task
- `tasks.bulkUpdateAssignees` — max 50, permission checks
- `tasks.bulkArchive` — max 50, timer auto-stop
**Verify:** Vitest tests: 50-cap enforcement, member cannot bulk-set "done", skips inaccessible tasks.
**Commit message:** `feat(phase-3): bulk task actions backend`

---

### Subtask 3.5: Task list page — basic table shell ✅
**Files modified:** `app/(dashboard)/tasks/page.tsx`
**Files created:** `components/task-list-table.tsx`
**Depends on:** 3.0, 3.2
**What:**
- Replace stub with real page that calls `tasks.list` query
- Render a `<Table>` (shadcn) with columns: checkbox, title, project, assignees, status, work category, time, actions
- Loading skeleton state
- Empty state ("No tasks yet" with description)
- Cursor-based "Load more" button at bottom
- No inline editing yet — just display
**Verify:** Start `npx convex dev` + `npm run dev`. Navigate to /tasks. See table with columns. If no tasks, see empty state.
**Commit message:** `feat(phase-3): task list table shell with pagination`

---

### Subtask 3.6: Inline task creation ✅
**Files modified:** `components/task-list-table.tsx`, `app/(dashboard)/tasks/page.tsx`
**Depends on:** 3.5
**What:**
- Empty row at bottom of table with input field
- Type title + Enter → calls `tasks.create` → new row appears
- Escape cancels
- Mobile: Floating Action Button that opens a simple dialog with title input
**Verify:** Type a task name in the empty row, press Enter. Task appears in list. Press Escape — nothing created. On mobile viewport, see FAB instead of inline row.
**Commit message:** `feat(phase-3): inline task creation + mobile FAB`

---

### Subtask 3.7: Inline editing — status, project, assignees, work category ✅
**Files created:** `components/task-status-select.tsx`, `components/task-project-selector.tsx`, `components/task-assignee-picker.tsx`, `components/task-category-select.tsx`
**Files modified:** `components/task-list-table.tsx`
**Depends on:** 3.5, 3.1
**What:**
- **Status cell:** Click → Popover with color-coded status pills. "Done" disabled for members.
- **Project cell:** Click → Popover with searchable project list grouped by client. Recently used at top.
- **Assignee cell:** Click → Popover with multi-select people picker (avatar + name).
- **Work category cell:** Click → Popover with category dropdown. Auto-assign suggestion on change.
- All auto-save immediately.
**Verify:** Click each cell, make a change, see it persist on refresh. Test auto-assign suggestion.
**Commit message:** `feat(phase-3): inline editing — status, project, assignees, category`

---

### Subtask 3.8: Task row actions (overflow menu) ✅
**Files created:** `components/task-actions-menu.tsx`
**Files modified:** `components/task-list-table.tsx`
**Depends on:** 3.3, 3.5
**What:**
- Three-dot `DropdownMenu` in actions column
- Duplicate, Archive (undo toast), Delete (confirm dialog), Move to Project
**Verify:** Test each action. Duplicate → new task. Archive → undo toast. Delete → confirm. Move → blocked with time entries.
**Commit message:** `feat(phase-3): task row actions — duplicate, archive, delete, move`

---

### Subtask 3.9: Filter bar + URL persistence ✅
**Files created:** `components/task-filters.tsx` (includes mobile filter drawer)
**Files modified:** `app/(dashboard)/tasks/page.tsx`
**Depends on:** 3.5
**What:**
- Desktop: horizontal filter bar (client, project, assignee, status, date range)
- URL search param persistence
- Removable filter chips + "Clear all"
- Mobile: Sheet drawer with stacked filters
- Grouping dropdown in filter bar
**Verify:** Apply filters → URL updates. Refresh → filters persist. Clear chips. Mobile drawer works.
**Commit message:** `feat(phase-3): task filters with URL persistence + mobile drawer`

---

### Subtask 3.10: Grouping ✅
**Files modified:** `components/task-list-table.tsx`, `app/(dashboard)/tasks/page.tsx`
**Depends on:** 3.9
**What:**
- Collapsible sections when groupBy is set (Client, Project, Assignee, Status)
- Section header with group name + task count
- Inline creation inherits group context
**Verify:** Group by Status → see collapsible sections. Combine with filters.
**Commit message:** `feat(phase-3): task grouping with collapsible sections`

---

### Subtask 3.11: Indicator icons + hover popovers ✅
**Files created:** `components/task-indicators.tsx`, `components/task-subtask-popover.tsx`, `components/task-comment-popover.tsx`, `components/task-description-popover.tsx`
**Files modified:** `components/task-list-table.tsx`
**Depends on:** 3.5, 3.2
**What:**
- Icons next to title: has-description, comment count, subtask progress
- HoverCard popovers (desktop only) with preview content
- Click navigates to task detail
**Verify:** Hover icons → see popover. Click → navigates. No hover on mobile.
**Commit message:** `feat(phase-3): task indicator icons + hover preview popovers`

---

### Subtask 3.12: Bulk actions UI ✅
**Files created:** `components/task-bulk-bar.tsx`
**Files modified:** `components/task-list-table.tsx`, `app/(dashboard)/tasks/page.tsx`
**Depends on:** 3.4, 3.5
**What:**
- Checkbox column (hover-visible desktop, always mobile)
- "Select all" header checkbox (max 50)
- Floating bar: count, status picker, assignee picker, archive
- Selection clears after action
**Verify:** Select tasks → bar appears. Change status → updates. Archive → undo. Select all capped at 50.
**Commit message:** `feat(phase-3): bulk task actions with floating bar`

---

### Subtask 3.13: Mobile responsive pass ✅
**Files modified:** `components/task-list-table.tsx`, `app/(dashboard)/tasks/page.tsx`, `components/task-actions-menu.tsx`, `components/task-bulk-bar.tsx`
**Depends on:** 3.5–3.12
**What:**
- Card layout on mobile instead of table
- FAB for creation, filter drawer, no hover popovers
- Checkbox always visible, bulk bar at bottom
**Verify:** Mobile viewport: cards, FAB, drawer, bulk bar all work.
**Commit message:** `feat(phase-3): mobile card layout + responsive polish`

---

## Vitest Test Cases

### File: `convex/tasks.test.ts`

**tasks.create**
- creates task with correct defaults (status=inbox, billable=true, assigneeIds=[], isArchived=false)
- creates task with provided fields (title, projectId, assigneeIds)
- trims whitespace from title
- rejects empty title
- creates subtask with parentTaskId, inherits parent's projectId
- rejects subtask if parent doesn't exist
- rejects subtask of a subtask (no nesting beyond 1 level)

**tasks.update**
- updates title
- updates projectId (sets both projectId, updates recentProjectIds on user)
- updates assigneeIds
- updates workCategoryId
- updates estimate (integer minutes)
- updates billable flag
- clears optional field when set to null
- blocks projectId change if time entries exist (constraint #27)
- admin can update any task
- member can update only assigned tasks
- member cannot update unassigned task (throws)

**tasks.updateStatus**
- admin can set any status including "done"
- member can set inbox, today, next_up, admin_review, stuck
- member cannot set "done" (throws "Admin access required")
- updates status on task record

**tasks.list**
- returns tasks with enrichment (project name, client name, assignees, etc.)
- excludes subtasks (parentTaskId != null) from results
- excludes archived tasks by default
- includes archived when includeArchived=true
- admin sees all tasks
- member sees only tasks where they are in assigneeIds
- paginates with cursor (50 per page)
- filters by clientId (via project lookup)
- filters by projectId
- filters by assigneeId
- filters by status
- filters by date range (creationTime)
- combines multiple filters with AND logic
- returns empty array when no tasks match

**tasks.getAutoAssignSuggestion**
- returns suggested user when project has default assignee for category
- returns null when no default assignee configured
- returns null when project has no defaultAssignees

**tasks.duplicate**
- copies title, description, assigneeIds, projectId, estimate, workCategoryId, billable
- sets status to inbox
- sets isArchived to false
- does NOT copy parentTaskId (duplicate is always top-level)
- admin can duplicate any task
- member can duplicate only assigned tasks

**tasks.archive**
- sets isArchived=true on task
- cascades to subtasks
- auto-stops running timer on task (creates time entry, clears user timer fields)
- admin can archive any task
- member can archive only assigned tasks

**tasks.remove**
- deletes task and related records (subtasks, comments, attachments, activity log)
- blocked if time entries exist (throws)
- admin only (member throws)

**tasks.moveToProject**
- changes projectId on task
- clears workCategoryId
- cascades to subtasks
- blocked if time entries exist (throws with explanation)
- admin only

**tasks.bulkUpdateStatus**
- updates status on multiple tasks
- caps at 50 tasks
- rejects > 50 tasks
- member cannot bulk-set "done"
- skips tasks member cannot access (returns count of actually updated)

**tasks.bulkUpdateAssignees**
- updates assigneeIds on multiple tasks
- caps at 50
- admin can update any, member only assigned

**tasks.bulkArchive**
- archives multiple tasks
- cascades subtask archive per task
- auto-stops timers
- caps at 50

**users.listAll**
- returns all non-anonymized users with id, name, avatarUrl, role

**users.updateRecentProjects**
- adds projectId to front of recentProjectIds
- deduplicates (if already in list, moves to front)
- caps at 5 entries
- creates array if recentProjectIds is undefined

---

## Dependency Graph

```
3.0 (shadcn installs)
 │
 ├─→ 3.1 (CRUD backend)
 │    ├─→ 3.2 (list query)
 │    │    ├─→ 3.5 (table shell) ← also needs 3.0
 │    │    │    ├─→ 3.6 (inline creation)
 │    │    │    ├─→ 3.7 (inline editing) ← also needs 3.1
 │    │    │    ├─→ 3.8 (row actions) ← also needs 3.3
 │    │    │    ├─→ 3.9 (filters + URL)
 │    │    │    │    └─→ 3.10 (grouping)
 │    │    │    ├─→ 3.11 (indicators + popovers)
 │    │    │    └─→ 3.12 (bulk actions) ← also needs 3.4
 │    │    │
 │    │    └─→ 3.13 (mobile pass) ← needs 3.5–3.12
 │    │
 │    ├─→ 3.3 (actions backend)
 │    └─→ 3.4 (bulk backend)
```

## Suggested Session Order

1. **3.0** — Install shadcn components (5 min)
2. **3.1** — Task CRUD backend + tests (30 min)
3. **3.2** — Task list query + tests (30 min)
4. **3.3** — Task actions backend + tests (25 min)
5. **3.4** — Bulk actions backend + tests (20 min)
6. **3.5** — Table shell UI (25 min)
7. **3.6** — Inline creation (15 min)
8. **3.7** — Inline editing cells (30 min)
9. **3.8** — Row actions menu (20 min)
10. **3.9** — Filter bar + URL persistence (25 min)
11. **3.10** — Grouping (20 min)
12. **3.11** — Indicator icons + hover popovers (25 min)
13. **3.12** — Bulk actions UI (20 min)
14. **3.13** — Mobile responsive pass (25 min)

---

## How to Start Each Session

Copy-paste this into a new Claude Code session:

```
Read docs/phase-3-plan.md and execute Subtask 3.X.
Read CLAUDE.md for all constraints.
Read the existing files listed in the subtask's "Depends on" section.
Follow existing patterns from convex/clients.ts and convex/projects.ts.
Commit when done with the suggested commit message.
```

---

## Key Constraints Checklist (from CLAUDE.md)

- [ ] No `/app/api/` routes — all through Convex
- [ ] Durations stored as integer minutes
- [ ] Subtasks 1-level only, excluded from main list
- [ ] Time entries chain: time → task → project → client
- [ ] "Done" status = admin only
- [ ] Move-to-project blocked if time entries exist
- [ ] Billable defaults to true
- [ ] Undo toast = 5-second delayed mutation
- [ ] Cursor-based pagination, 50 per page
- [ ] Team members see only assigned tasks
- [ ] All shadcn/ui components — never hand-roll
- [ ] Status pills include text label (not color alone)
- [ ] Keyboard navigable (tab through rows, Enter to open)
