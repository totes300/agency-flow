# Phase 5: Today View & Review Flow

## What to Build

The Today view (tasks with status = "Today" — a manual status tag, not calendar-based), the task completion flow with validation, the admin review workflow, the daily summary page, and the weekly timesheet view.

## Use Cases

**UC-5.1: Personal Today View**
Team member sees only tasks where status = "Today" and they are an assignee. "Today" is a manually-set status tag — it is not calendar-based, does not reset at midnight, and has no date association. Tasks remain in "Today" until the user or admin manually changes their status.

This includes subtasks — displayed as `Parent Task → Subtask Name`. Each task shows a **number** (1, 2, 3...) indicating its priority position, and a **drag handle** to reorder. Dragging a task via its handle immediately updates the numbers for all affected tasks. Order is stored per-user in a `todayOrder` table (userId + ordered array of taskIds) — so User A reordering does not affect User B's order. Grouping options: by project, assignee, client (numbers still reflect the underlying priority order within each group).

**UC-5.2: Admin Today View**
Admin has a toggle: "My Tasks" / "All Team". "All Team" shows all Today tasks grouped by assignee (switchable to project or client). Admin can see but NOT reorder other people's task order.

**UC-5.3: Complete a Today Task**
User clicks a checkbox on a Today task. Before proceeding, the system validates:
1. Time logged > 0 on this task
2. A project is assigned
3. All subtasks are completed or deleted (archived subtasks do NOT count as completed — they still block)

If validation fails, show what's missing. If it passes, a modal opens with an optional client update text field ("Add a note for the client?" — user can skip).

After submitting:
- Task gets a strikethrough in the Today view only (not in the main task list)
- Moves to a "Completed" section at the bottom of the Today view
- Status changes to "Admin Review"
- Client update text stored on the task
- Notification record written for admin(s) (UI in Phase 7, but records written now)

**UC-5.4: Admin Reviews Completed Work**
Admin can view all tasks in "Admin Review" status. For each task, admin can:
- Read/edit the client update text
- **Approve** → status becomes "Done", notification record written for assignee
- **Reject** → status returns to "Today" or "Next Up" (admin chooses), admin adds a comment explaining why, notification record written for assignee
- Copy client update text to clipboard

All review actions logged in activity log.

**UC-5.5: Daily Summary Page (Admin Only)**
Admin selects a date (defaults to today) and sees all tasks completed on that date, grouped by client. Each entry shows: task name, project, who completed it, client update text. Each client group has a "Copy all" button that copies all update texts for that client in a formatted block (format: `**Project Name** — Task Name: update text`). Individual texts are also copyable.

**UC-5.6: Weekly Timesheet View (My Time)**
Accessible from the main nav as "My Time" (visible to all users — distinct from admin-only "Timesheets" which is the billing feature in Phase 6). Each user sees their own weekly timesheet. Admin can switch between team members or view all team members at once.

The view shows a week grid: days (Mon–Sun) as columns, with a week picker to navigate between weeks. For each day, the view lists time entries logged on that date — each showing **task name** and **duration**. Day column headers show the total hours for that day. A weekly total is shown at the end of the row. If a day has more than 5 entries, show the first 5 with a "+N more" expander — the day total is always visible regardless.

**Team member view:** sees only their own time entries for the selected week.
**Admin view:** a toggle or dropdown to select a specific team member, or "All Team" which shows each team member as a row with their daily time entries expandable per day. Admin can click into any entry to navigate to the task.

Empty states: "No time logged this week" when a week has no entries.

## Acceptance Criteria

- [ ] Today view shows correct tasks scoped by user and status = "Today" (not calendar-based)
- [ ] Subtasks with "Today" status appear with parent context
- [ ] Drag-and-drop reordering works (desktop and touch) via drag handles, numbered positions update immediately
- [ ] Per-user ordering stored in `todayOrder` table — users' orders are independent
- [ ] Admin toggle shows "My Tasks" vs "All Team" correctly
- [ ] Completion flow validates all three conditions before proceeding
- [ ] Archived subtasks block parent completion (not treated as "done")
- [ ] Client update text is optional and stored correctly
- [ ] Completed tasks show strikethrough in Today only, status = Admin Review
- [ ] Admin can approve/reject with correct status transitions and notifications
- [ ] Daily summary shows grouped update texts with formatted copy functionality
- [ ] Weekly timesheet shows time entries per day (task name + duration) for selected week
- [ ] Team members see their own weekly timesheet; admin can view any team member or all
- [ ] Week picker navigates between weeks; day totals and weekly total shown
- [ ] Empty state shown on Today view when no tasks have "Today" status ("Nothing on your plate — move tasks to Today from the task list")
- [ ] Empty state shown on weekly timesheet when no time logged
