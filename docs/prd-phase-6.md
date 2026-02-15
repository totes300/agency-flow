# Phase 6: Billing & Timesheets

## What to Build

Timesheet generation per client/month, retainer period management with rollover and overage calculations, and CSV export.

## Use Cases

**UC-6.1: Generate a Timesheet**
Admin selects a client and month (defaults to previous month). System pulls all time entries for that client in the selected period and creates a draft timesheet. Entries are grouped by project, then by task. Each entry shows: task name, team member, date, hours, and note.

Each project type adds its own summary section:
- **Retainer**: Allocated hours (included + rollover), used, remaining, rollover used, overage hours × overage rate as a line item
- **Fixed**: Estimate vs actual per category (primarily internal control — may not be sent to client)
- **T&M**: Total hours × rate for the period

All monetary values displayed in the client's currency.

**UC-6.2: Review and Advance Timesheet Status**
Admin can review the draft timesheet, then manually advance the status: Draft → Sent → Paid. These are tracking states only — no automated actions on transition.

**UC-6.3: Export Timesheet**
Admin can export a timesheet as CSV: flat rows with all relevant fields (client, project, task, member, date, hours, rate, amount, note, billable). Encoded as UTF-8 with BOM for Excel compatibility with Hungarian characters.

File naming: `{ClientName}_Timesheet_{YYYY-MM}.csv`

> **Note:** PDF export is deferred to a future phase. For v1, admin exports CSV and uses their own invoice template.

**UC-6.3b: Regenerate Timesheet**
If time entries are added or modified after a timesheet is generated, the timesheet list shows a warning badge: "X new entries since generated." Admin can click **Regenerate** to pull in the latest entries. Regeneration is only available for timesheets in Draft status. Sent and Paid timesheets store a denormalized JSON blob of all computed data and are truly frozen — editing time entries after a timesheet is Sent/Paid does not affect it.

**UC-6.4: Retainer Period Lazy Creation**
When a retainer is active, the system ensures a usage period exists for the current month via lazy creation — the period is created on first access (when logging time against the retainer or viewing the retainer detail), not via a cron job. Each period tracks: included hours, rollover hours available, hours used (always computed from time entries), overage hours.

**UC-6.5: Rollover Calculation**
When a new period is created, the system calculates rollover from the previous period: unused hours carry forward for up to 3 months (hardcoded for v1). Hours older than 3 months expire and are marked as such.

## Business Rules

- Timesheets are not invoices — admin exports and invoices manually
- No external billing integrations in v1
- Retainer periods run on calendar months
- Rollover expiry is 3 months (hardcoded for v1)
- Overage is always a separate line item on the timesheet

## Acceptance Criteria

- [ ] Admin can generate a timesheet for any client + month
- [ ] Timesheet groups entries by project then task, with correct per-type summaries
- [ ] Draft → Sent → Paid status flow works (backward movement allowed, e.g., Sent → Draft)
- [ ] CSV export produces a flat file with all relevant data and correct file naming
- [ ] Retainer periods lazy-created on first access (viewing retainer or logging time)
- [ ] Rollover calculation correctly carries forward unused hours and expires old ones
- [ ] Overage hours calculated and shown as separate line item
- [ ] Regenerate button available on Draft timesheets; warns when new entries exist since generation
- [ ] Timesheet list shows: client, period, status, total hours, total amount, generated date
- [ ] Empty state shown when no timesheets exist or no time entries for a selected period
