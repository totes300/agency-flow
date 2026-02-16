# Phase 6: Billing & Reports — Implementation Tasks

Each task is a self-contained, committable unit. Complete them in order.

---

## Task 6.1: Schema Changes + Timesheet Backend Core

**Commit message:** `feat(phase-6): timesheet schema + generate/get/list mutations`

**What to do:**
- Modify `convex/schema.ts` — update `timesheets` table:
  - Add `projectId`, `periodStart`, `periodEnd`, `sentAt`, `paidAt`
  - Remove old `period` field
  - Update indexes
- Create `convex/timesheets.ts` with:
  - Internal helper `computeReportData(ctx, projectId, periodStart, periodEnd)` — the core aggregation logic:
    - Fetches project, client, tasks, time entries, work categories, users
    - Groups by work category → tasks → subtasks
    - Each line: title, clientUpdateText, hours, rate, amount, billable flag
    - Rate resolution: Fixed (per-category from projectCategoryEstimates), T&M (tmCategoryRates or hourlyRate), Retainer (overage)
    - Non-billable tasks included with amount = 0
    - Retainer summary (included, rollover, used, overage)
  - `timesheets.generate` mutation — creates Draft, prevents duplicates for same project + overlapping range
  - `timesheets.get` query — returns full report data (live for Draft, frozen for Sent/Paid)
  - `timesheets.list` query — all timesheets with client/project names, totals, status
- Create `convex/timesheets.test.ts` with tests for:
  - Generate draft with correct data structure
  - Rate resolution for each billing type
  - Non-billable tasks included with €0
  - Subtasks grouped under parent
  - Date range filtering
  - Duplicate prevention
  - Permission checks (admin-only)

---

## Task 6.2: Status Transitions + Regenerate + Stale Detection

**Commit message:** `feat(phase-6): timesheet status flow (Draft→Sent→Paid) + regenerate`

**What to do:**
- Add to `convex/timesheets.ts`:
  - `timesheets.updateStatus` mutation:
    - Draft → Sent: freeze data into `data` field, set `sentAt`
    - Sent → Paid: set `paidAt`
    - Backward: Sent → Draft (clear sentAt, unfreeze), Paid → Sent (clear paidAt)
  - `timesheets.regenerate` mutation — Draft only, re-runs `computeReportData`, updates `generatedAt`
  - `timesheets.checkStaleEntries` query — count entries added/modified after `generatedAt`
  - `timesheets.remove` mutation — Draft only
- Add tests:
  - Status transitions forward and backward
  - Frozen data on Sent/Paid doesn't change when time entries are modified
  - Regenerate only works on Draft
  - Stale entry detection
  - Delete only works on Draft

---

## Task 6.3: Billing Overview Query

**Commit message:** `feat(phase-6): billing overview query for dashboard`

**What to do:**
- Add to `convex/timesheets.ts`:
  - `timesheets.getBillingOverview` query:
    - Returns all active clients with their active projects
    - For each project: total hours in the given date range, estimated amount, last report (status + date)
    - Computes "unbilled hours" = hours not covered by any existing timesheet's date range
    - Admin-only
- Add tests for billing overview accuracy

---

## Task 6.4: Reports Page — Billing Dashboard UI

**Commit message:** `feat(phase-6): reports billing dashboard page`

**What to do:**
- Create `app/(dashboard)/reports/page.tsx`:
  - Page header: "Reports"
  - Date range picker (defaults to last month, custom range supported)
  - Toggle: "Show unbilled only" / "Show all"
  - Table showing clients/projects with: Client, Project, Type badge, Unbilled Hours, Est. Amount, Last Report date, Status badge, Action button
  - Client name shown once for grouped projects
  - Action: "Generate Report" or "View Report" depending on state
  - Empty state for no activity
  - Loading skeleton
- Create `components/report-generate-dialog.tsx`:
  - Dialog with project/client info pre-filled
  - Date range picker (editable)
  - Quick select: Last month, This month, Last quarter
  - Preview: entry count, total hours
  - Generate button → creates Draft → navigates to detail
- Update `components/app-sidebar.tsx` — add "Reports" nav item to `adminNav`

---

## Task 6.5: Report Detail Page

**Commit message:** `feat(phase-6): report detail page with structured view`

**What to do:**
- Create `app/(dashboard)/reports/[id]/page.tsx`:
  - Header: project name, client name, period, status badge, generated date
  - Action buttons: Export CSV, Mark as Sent/Paid, Regenerate (Draft only), Delete (Draft only)
  - Stale data warning banner (if new entries since generated, Draft only)
- Create `components/report-detail.tsx` — renders the report content:
  - Work category sections as headers
  - Tasks listed under each category: title, description, hours, rate, amount
  - Subtasks indented under parent tasks with tree lines
  - Non-billable section at the bottom with €0 amounts
  - Category subtotals
  - Grand total footer (total hours, billable hours, total amount)
  - Retainer summary card (for retainer projects): included, rollover, available, used, overage × rate
  - Fixed project internal-only budget banner: estimate vs actual per category (collapsible, never exported)

---

## Task 6.6: CSV Export

**Commit message:** `feat(phase-6): structured CSV export with UTF-8 BOM`

**What to do:**
- Create `lib/csv-export.ts`:
  - Function that takes report data and generates structured CSV string
  - UTF-8 BOM for Excel compatibility with Hungarian characters
  - Structure mirrors the report: category headers → task rows → subtask rows (indented) → subtotals → total
  - Columns: Category, Task, Description, Hours, Rate, Amount, Billable
  - Retainer projects: additional summary rows for included/rollover/overage
- Wire up "Export CSV" button on report detail page
  - Client-side Blob URL download
  - File naming: `{ClientName}_{ProjectName}_{start}_to_{end}.csv`
- Add unit test for CSV generation (correct structure, BOM present, special characters escaped)
