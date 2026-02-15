# Agency Flow — Master PRD

> For Claude Code plan mode. Describes WHAT to build and WHY. See `prd-phase-{N}.md` for per-phase details.

## Core Loop

Create tasks inline → assign to projects → team tracks time → admin reviews completed work → generate client timesheets → export CSV for billing.

---

## Data Model

### Client
A company the agency works for. Has a currency (EUR/USD/HUF) that all its projects inherit. Has one or more projects.

### Project
A container for work under a client. Three billing types — but billing type only affects reporting/billing, never the daily task or time tracking experience:

**Fixed** — One-off work. Broken into work categories (Design, Dev, PM, etc.), each with estimated hours, internal cost rate, and client billing rate. Tracks burn and profitability per category.

**Retainer** — Recurring monthly hours. Has: included hours/month, overage rate, 3-month rollover window (hardcoded for v1). Runs on calendar months. Has active/inactive status. System ensures monthly usage periods exist via lazy creation (created on first access). Shows warnings at 80%+ usage and when rollover hours are about to expire.

**T&M** — Open-ended. Has hourly rate(s). Time accumulates; admin generates timesheets for any period.

### Task
A unit of work inside a project. Has: title, rich text description (Tiptap JSON), status, assignee(s), project, work category (reference to global `workCategories` table), estimate (integer minutes), logged time, billable flag (default `true`), optional client update text, file attachments, optional parent task reference.

**Statuses**: Inbox, Today, Next Up, Admin Review, Stuck, Done

### Subtask
A full task in every way — same fields, same behaviors, same completion flow. Only differences: has a parent reference (1 level only), inherits parent's project (locked), time rolls up to parent total.

### Time Entry
A block of time logged against a task. Has: date (`YYYY-MM-DD` string), duration (integer minutes, rounded up from timer), user, optional note, creation method (timer / manual).

### Other Entities
- **Work Category** — Global admin-managed list (e.g., Design, Development, Copywriting, PM, Testing). Used on tasks and on Fixed project category breakdowns.
- **Timesheet** — Monthly export per client. Status: Draft → Sent → Paid. Draft stores `generatedAt`; Sent/Paid store frozen denormalized data.
- **Activity Log** — Chronological record of everything that happens on a task.
- **Comment** — Internal comments on tasks using Tiptap editor with Mention extension for @mentions. Immutable after posting.
- **File Attachment** — Files on tasks via Convex file storage. Max 10 MB per file, 20 files per task.
- **Notification** — In-app only (v1). Bell icon with unread count. Notification records are written from Phase 4 onward; the bell UI is built in Phase 7.

---

## Roles & Permissions

**Admin**: Full CRUD on everything. Sees all tasks, billing data, timesheets. Can set "Done" status, approve/reject completed work.

**Team Member**: Sees only tasks assigned to them. Creates tasks, logs time, uploads files. Completes tasks (triggers admin review). Edits/deletes own time entries only. Cannot see: billing rates, profitability, timesheets.

---

## Key Business Rules

- Currency is per-client, inherited by all downstream data. No conversion.
- One timer per user at a time — starting a new one auto-stops the previous. Timer state is server-side (stored on user record), not client-side.
- "Today" is a status tag, not a calendar date. Tasks with status "Today" appear in the Today view regardless of when they were set. There is no automatic daily reset — tasks stay in "Today" until manually moved.
- Team members cannot set "Done" directly — they complete tasks which enter "Admin Review".
- Retainer rollover: unused hours carry forward for 3 months (hardcoded for v1). Expired hours are marked.
- Retainer overage: hours beyond allocation billed at overage rate, shown as separate line on timesheets.
- Inactive retainers: hidden from project selector, no new periods created, existing data preserved.
- Archiving a client cascades to its projects and tasks. Running timers auto-stopped.
- Auto-assign: projects have default assignees per work category. When a task's work category is set, the system suggests (not forces) the default person.

---

## Implementation Phases

### Phase 1: Foundation
Scaffolding, auth integration (Clerk + Convex + webhooks), full schema design (including server-side timer fields), role helpers, app shell with responsive nav and `Cmd+K` global search.

**Done when**: Sign-up works, role syncs to Convex, app shell renders with nav and search.

### Phase 2: Core Data
Client CRUD, project creation (all three types with type-specific fields), project detail views.

**Done when**: Admin can manage clients and create all project types.

### Phase 3: Task Management
Task list with inline creation, filtering/grouping, project selector, multi-assign with auto-suggest, statuses, task actions, bulk operations (multi-select + status/assignee/archive).

**Done when**: Full task list experience works with filters, grouping, inline editing, and bulk actions.

### Phase 4: Task Detail & Time Tracking
Task detail modal, rich text descriptions, subtasks, file attachments, timer, Add Time component, time entries list, activity log, comments with @mentions.

**Done when**: Full task detail works. Time can be logged via timer and Add Time component. Activity and comments work.

### Phase 5: Today View & Review Flow
Personal Today view (drag-and-drop sortable), admin Today view, completion flow with validation, admin review (approve/reject), daily summary page, weekly timesheet view (personal + admin).

**Done when**: Team can work through Today, complete with validation, admin can review. Daily summary shows update texts. Weekly timesheet shows time entries per person per day.

### Phase 6: Billing & Timesheets
Timesheet generation, retainer period management (rollover, overage), CSV export.

**Done when**: Admin can generate, review, and export timesheets as CSV with correct billing calculations.

### Phase 7: Polish & Cross-cutting
Notifications, responsive/mobile pass, permission enforcement audit, keyboard shortcuts.

**Done when**: Notifications work, mobile is polished, permissions locked down.
