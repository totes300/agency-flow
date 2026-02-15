# Phase 3: Task Management

## What to Build

The main task list view — the primary workspace where users see, create, filter, and manage tasks.

## Use Cases

**UC-3.1: View Task List**
Users see a table of all tasks. Each row shows:
- **Title** — clickable to open task detail. Next to the title, small inline indicator icons: subtask count (e.g., `3/5`), comment count, and a description icon (if a description exists). Each indicator is hoverable (see UC-3.1b).
- **Project** — `Client → Project` with type icon, clickable inline to change (opens project selector)
- **Assignees** — avatar stack (max 3, then +N), clickable inline to change (opens people picker)
- **Status** — color-coded pill, clickable inline to change (opens status dropdown)
- **Work Category** — text label, clickable inline to change (opens work category dropdown)
- **Time** — logged time with play/timer button, clickable to open Add Time popover (Phase 4)
- **Actions** — three-dot overflow menu (see UC-3.8)

All metadata fields are editable directly in the table row — clicking a field opens its editor inline without navigating away. This should feel like editing a Notion or Coda table. Changes auto-save immediately.

Admin sees all tasks; team members see only tasks assigned to them.

**UC-3.1b: Hover Preview Popovers**
Hovering over the inline indicator icons next to the task title shows a preview popover:
- **Subtask icon** — shows "X/Y subtasks completed" header, lists the first 4–5 subtasks with checkboxes (read-only in the popover), and a "View all subtasks >" link that opens the task detail.
- **Comment icon** — shows "N comments" header, the most recent comment (avatar, name, date, text), and an "Open comments >" link that opens the task detail.
- **Description icon** — shows "Description" header, a truncated rich text preview (first ~200 characters rendered from Tiptap JSON), and a "View full description >" link that opens the task detail.

Popovers appear on hover (desktop only, not on mobile). Clicking any indicator icon opens the task detail directly.

**UC-3.2: Create a Task Inline**
An empty row at the bottom of the list lets users type a task name and press Enter to create it. New tasks default to status "Inbox" with no assignee and no project. Escape cancels. On mobile, a Floating Action Button replaces the empty row.

**UC-3.3: Filter Tasks**
Filter bar with: client, project, assignee, status, date range. Filters combine with AND logic and show as removable chips. Filtered state persists in URL params. Empty state shown when no tasks match. On mobile, filters collapse into a drawer.

**UC-3.4: Group Tasks**
Group by: None (flat list), Client, Project, Assignee, or Status. Groups are collapsible sections with a header and task count. Works alongside active filters.

**UC-3.5: Assign Task to Project**
Searchable dropdown showing projects grouped by client. Each project shows its type (Fixed/Retainer/T&M). Inactive projects excluded. Recently used projects sort to top (tracked via a `recentProjectIds` array on the user record — last 5 projects, updated when a task is assigned to a project). Selecting sets both client and project on the task. Displayed as `Client → Project` chip.

**UC-3.6: Assign People to Task**
Multi-assign via a people picker. Shows as an avatar stack (max 3 visible, then +N). Add/remove inline without opening the detail modal.

**Auto-assign**: When a task's work category is set (from the global work categories list), the system checks the project's default assignees and suggests the matching person. User confirms or overrides. Does not replace existing assignees — additive only.

**UC-3.7: Change Task Status**
Inline dropdown with color-coded status pills: Inbox, Today, Next Up, Admin Review, Stuck, Done. Setting "Today" flags it for the Today view — this is a manual status tag, not a calendar-based assignment. Tasks stay in "Today" until manually moved. Setting "Done" is admin-only — team members go through the completion flow (Phase 5).

**UC-3.8: Task Actions**
Overflow menu per task row:
- **Duplicate** — copies: title, description, assignees, project, estimate, work category, billable flag. Does NOT copy: time entries, subtasks, attachments, client update text, comments, activity log. New task status = Inbox.
- **Archive** — hides from default views, data retained, toast with undo (5-second delayed mutation)
- **Delete** — confirmation modal (irreversible)
- **Move to different project** — opens project selector. **Blocked if any time entries exist** on the task (time entries chain to project → client; moving would silently reassign billed time). Admin sees a warning explaining this.

**UC-3.9: Bulk Task Actions**
Users can select multiple tasks via checkboxes (checkbox appears on row hover, or always visible on mobile). When one or more tasks are selected, a floating action bar appears at the bottom of the screen with: **Change Status**, **Change Assignee**, **Archive Selected**. Archive shows a toast with undo (5-second delayed mutation). Selection clears after any action completes. "Select all" checkbox in the header selects all visible (filtered) tasks. Max 50 tasks per bulk action to stay within Convex mutation limits.

## Subtasks

### 3.1 Task List Query & Display
- [ ] Convex query: listTasks (admin sees all, team member sees only assigned, supports pagination, filtering, grouping)
- [ ] Task list table with inline-editable columns: title, project chip, assignee avatars, status pill, work category, logged time, actions menu
- [ ] Inline indicator icons next to task title: subtask count (X/Y), comment count, has-description icon
- [ ] Hover popovers on indicator icons: subtask preview (first 4–5 with checkboxes), latest comment preview, description preview (~200 chars)
- [ ] Popovers are desktop-only hover; on mobile, tapping icon opens task detail
- [ ] All metadata fields editable inline (click to edit, auto-save) — Notion/Coda table feel
- [ ] Mobile: card layout instead of table (indicators shown as small icons, no hover popovers)
- [ ] Empty state when no tasks or no matches
- [ ] Write Vitest tests: role scoping (admin vs member), pagination, filter combinations

### 3.2 Inline Task Creation
- [ ] Empty row at bottom of list (desktop), FAB (mobile)
- [ ] Type name + Enter creates task (status = Inbox, no assignee, no project)
- [ ] Escape cancels
- [ ] Convex mutation: createTask
- [ ] Write Vitest tests: task created with correct defaults

### 3.3 Filters
- [ ] Filter bar: client, project, assignee, status, date range
- [ ] AND logic between filters
- [ ] Removable chips for active filters
- [ ] URL param persistence (filters survive page refresh)
- [ ] Mobile: filters collapse into a drawer
- [ ] Write Vitest tests: filter query logic with multiple combinations

### 3.4 Grouping
- [ ] Group by: None, Client, Project, Assignee, Status
- [ ] Collapsible sections with header and task count
- [ ] Works alongside active filters

### 3.5 Project Selector
- [ ] Searchable dropdown grouped by client
- [ ] Shows project type badge (Fixed/Retainer/T&M)
- [ ] Excludes inactive projects
- [ ] Recently used projects at top (updates `recentProjectIds` on user record)
- [ ] Selecting sets both client and project on the task
- [ ] Write Vitest tests: inactive exclusion, recent projects ordering

### 3.6 People Assignment
- [ ] Multi-assign people picker
- [ ] Avatar stack (max 3 visible, then +N)
- [ ] Add/remove inline without opening detail
- [ ] Auto-assign: when work category is set, suggest default assignee from project mappings
- [ ] Write Vitest tests: auto-assign suggestion logic, additive only

### 3.7 Status Changes
- [ ] Inline dropdown with color-coded pills: Inbox, Today, Next Up, Admin Review, Stuck, Done
- [ ] "Done" restricted to admin
- [ ] Convex mutation: updateTaskStatus (with permission check)
- [ ] Write Vitest tests: admin can set Done, member cannot, status transitions logged

### 3.8 Task Actions
- [ ] Overflow menu per row: Duplicate, Archive, Delete, Move to Project
- [ ] Duplicate: copies title, description, assignees, project, estimate, work category, billable. Status = Inbox. No time/subtasks/attachments/comments.
- [ ] Archive: 5-second undo toast
- [ ] Delete: confirmation modal
- [ ] Move to Project: blocked if time entries exist, warning shown
- [ ] Write Vitest tests: duplicate field copying, archive undo, delete with entries blocked, move-with-time-entries blocked

### 3.9 Bulk Actions
- [ ] Checkbox selection on rows (hover on desktop, always visible on mobile)
- [ ] Floating action bar: Change Status, Change Assignee, Archive Selected
- [ ] Select All checkbox in header (selects visible/filtered, max 50)
- [ ] Archive with undo toast
- [ ] Selection clears after action
- [ ] Write Vitest tests: bulk mutation respects 50 cap, permission checks on bulk status change

## Acceptance Criteria

- [ ] Task list renders with all columns, scoped by role
- [ ] All metadata fields editable inline in the table row (status, assignee, project, work category) — auto-saves on change
- [ ] Inline indicator icons show next to task title: subtask count, comment count, has-description
- [ ] Hover popovers work on indicator icons: subtask list preview, latest comment, description preview
- [ ] Popovers are hover-only on desktop, tap-to-open-detail on mobile
- [ ] Inline task creation works (Enter to create, Escape to cancel)
- [ ] Filters combine correctly, persist in URL, show as removable chips
- [ ] Grouping works with all options, sections are collapsible
- [ ] Project selector is searchable, grouped by client, excludes inactive, recently-used at top
- [ ] Multi-assign works inline with auto-suggest from project defaults
- [ ] Status changes work inline, "Done" restricted to admin
- [ ] All task actions work (duplicate, archive with undo, delete with confirm, move)
- [ ] Bulk select with floating action bar: change status, change assignee, archive
- [ ] Empty state shown when no tasks exist or no tasks match filters
- [ ] Mobile: card layout, FAB for creation, filter drawer
