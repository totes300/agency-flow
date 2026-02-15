# Phase 4: Task Detail & Time Tracking

## What to Build

Task detail view (modal/drawer), rich text descriptions, subtasks, file attachments, time entry methods (timer + Add Time component), activity log, and comments.

## Use Cases

### Task Detail

**UC-4.1: Open Task Detail**
Clicking a task row opens a detail overlay (list stays visible behind). All changes auto-save — no save button. On mobile, this becomes a full-screen view.

The detail view shows:
- Editable title, status, logged time vs estimate, timer button
- Rich text description (Tiptap: bold, italic, strike, headings, lists, blockquote, code, checklists, horizontal rule — stored as Tiptap JSON)
- Subtasks section
- File attachments section (max 10 MB per file, 20 files per task)
- Editable metadata: status, assignees, project, work category (from global list), billable flag (default `true`, toggleable by anyone), estimate (integer minutes, displayed as hours)
- Time tracking: timer, manual entry form, and list of time entries
- Activity log and comment thread (on mobile, these collapse below the main content)

**UC-4.2: Manage Subtasks**
Inside a parent task's detail, users can create subtasks inline (type + Enter). Subtasks inherit the parent's project (locked, can't be changed). Each subtask is a full task — clicking it opens its own detail view with all the same fields and capabilities.

The parent task row in the main list shows a subtask count (e.g., "3/5 done"). The parent's displayed total time includes its own time plus all subtask time.

Subtasks can be reordered via drag-and-drop within the parent detail.

**UC-4.3: Attach Files**
Users can upload files (images, docs, PDFs) to a task from its detail view. Max 10 MB per file, 20 files per task. Attached files show: filename, type icon, size, who uploaded, when. Images preview inline; other files are downloadable. Files can be deleted by the uploader or an admin.

### Time Tracking

**UC-4.4: Start/Stop Timer**
User starts a timer from the task list row or from the task detail view. **Timer cannot be started on a task without a project** — if no project is assigned, prompt the user to assign one first. Only one timer per user — starting a new one auto-stops the previous with a toast ("Stopped timer on [Task Name] (Xm)" with Undo — 5-second delayed mutation).

Timer state is server-side: starting a timer stores `timerTaskId` and `timerStartedAt` on the user record in Convex. The UI calculates elapsed time by diffing `Date.now()` against the stored start timestamp. This means the timer survives browser closes, device switches, and page refreshes.

The running timer is always visible: a persistent indicator showing task name, elapsed time, and a stop button. On desktop this is in the header area; on mobile it's a sticky bottom bar (thumb-reachable).

Stopping the timer creates a time entry with the elapsed duration **rounded up to the nearest minute** (e.g., 7m 45s → 8m). Date is the user's local calendar date at stop time (if started at 11pm and stopped at 2am, the entry date is the stop date). No note prompt on stop. If the timer was under 1 minute, show a toast asking the user to save (as 1 minute) or discard (not a modal).

**Edge case — timer on archived/deleted task:** If an admin archives a client or deletes a task while another user has a timer running on it, the archive/delete mutation auto-stops the timer and saves the time entry before proceeding.

**UC-4.5: Add Time Entry**
Time can be added from two places, both using the same "Add Time" component. **The Add Time component is disabled on tasks without a project** — if no project is assigned, show a prompt to assign one first (same guard as the timer).

**From the task list:** Clicking the time cell on a task row opens a popover with the Add Time component.
**From the task detail:** An inline Add Time form in the time tracking section.

The Add Time component shows: preset duration chips (15m, 30m, 1h, 1.5h, 2h) plus a free-text duration input (accepts `1h 30m`, `1.5h`, `90m`, `1:30`), a date field (collapsed by default showing "today," expandable to a date picker for past entries), and an optional note. Submitting creates a time entry. Multiple entries per day per task allowed.

**UC-4.6: View and Edit Time Entries**
Task detail shows time entries (newest first, paginated — default 50, "load more"). Each shows: duration, date, team member, note. Users can edit/delete their own entries; admins can edit/delete any. Editing recalculates task total (and parent rollup for subtasks).

### Activity & Comments

**UC-4.7: Activity Log**
Every action on a task is logged chronologically: status changes, assignee changes, time entries (added/edited/deleted), subtask events (created/completed/deleted), description edits (logged as "User edited the description" — no diff, just timestamp), file uploads/deletions, admin review actions. Each entry shows who, what, when. Paginated — default 50 entries, "load more."

**UC-4.8: Comments with @mentions**
Users can post internal comments on tasks using a Tiptap editor with the Mention extension (supports bold, italic, lists, images). Typing `@` opens a team member search dropdown; selecting inserts a mention node containing the user's Convex ID. On save, the system scans for mention nodes and writes a notification record for each mentioned user (notification UI is built in Phase 7, but records are written now). Comments are stored as Tiptap JSON. Comments cannot be edited after posting. Authors can delete their own.

## Acceptance Criteria

- [ ] Task detail opens as overlay, auto-saves (debounced 1s), goes full-screen on mobile
- [ ] Tiptap editor works with all specified extensions, stores as JSON
- [ ] Subtasks: create, view, reorder, open own detail, time rolls up to parent
- [ ] File upload with 10 MB / 20 file limits, preview (images), download, and delete work
- [ ] Timer: one per user, auto-stop previous, global indicator, rounds up to nearest minute
- [ ] Timer blocked on tasks without a project (prompts assignment)
- [ ] Timer auto-stopped when task is archived/deleted by another user
- [ ] Add Time component: works from list popover and task detail, presets + free input + date picker + note
- [ ] Add Time component disabled on tasks without a project (same guard as timer)
- [ ] Time entries: list (paginated), edit, delete (own vs admin), recalculates totals
- [ ] Activity log captures all actions (paginated), description edits logged as minimal entries
- [ ] Comments use Tiptap with Mention extension, @mentions write notification records
