# Phase 3: Task Management

## What to Build

The main task list view — the primary workspace where users see, create, filter, and manage tasks.

## Use Cases

**UC-3.1: View Task List**
Users see a list of all tasks showing: task name, project (as `Client → Project` with type icon), assignee avatars, status pill, logged time, estimated time, last updated. Admin sees all tasks; team members see only tasks assigned to them.

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

## Acceptance Criteria

- [ ] Task list renders with all columns, scoped by role
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
