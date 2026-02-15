# Phase 2: Core Data

## What to Build

Client management and project creation for all three billing types, with type-specific detail views.

## Use Cases

**UC-2.1: Manage Clients**
Admin can create, edit, and archive clients. Each client has: company name, contact name, email, currency (EUR/USD/HUF). Client list shows name, currency, active project count, and hours logged this month. Clicking a client shows all its projects with type badges.

Archiving a client cascades — archives all its projects and tasks, auto-stops any running timers (saving the time entry). Archived clients are hidden by default but viewable via filter. Archive uses a toast with undo (5-second delayed mutation), not a confirmation modal. Permanent delete requires confirmation and is blocked if any projects have time entries.

**UC-2.1b: Manage Work Categories (Admin)**
Admin can manage a global list of work categories (e.g., Design, Development, Copywriting, Project Management, Testing, Wireframing). These are used across the app: on tasks (as work category), and on Fixed project category breakdowns. Categories can be added, renamed, and archived (archived = hidden from pickers but existing references preserved). Seeded with sensible defaults on first setup.

**UC-2.2: Create a Fixed Project**
Admin selects a client, names the project, chooses "Fixed" type. Then adds category estimates by selecting from the global work categories list (e.g., Design, Development, PM). Each selected category gets: estimated hours, sourced rate (internal cost/hr), billed rate (client price/hr). Categories can be added/removed from the project. Rates display in the client's currency. These project-level category estimates are separate from per-task estimates.

**UC-2.3: Create a Retainer**
Admin selects a client, names the project, chooses "Retainer" type. Sets: monthly included hours, overage rate/hr, start date. Rollover window is fixed at 3 months (hardcoded for v1). Retainer starts as active. On save, system lazy-creates a usage period for the current month. Mid-month starts get the full monthly allocation (no prorating).

**UC-2.4: Create a T&M Project**
Admin selects a client, names the project, chooses "T&M" type. Sets hourly rate(s) — either a single flat rate or per-category rates using the global work categories list.

**UC-2.5: Set Default Assignees per Project**
On any project, admin can assign a default team member per work category (from the global `workCategories` table — e.g., Design → Alice, Development → Bob, PM → Charlie). These mappings are stored as `workCategoryId → userId` pairs on the project. When a task in this project is assigned a work category, the system uses these mappings to suggest the default assignee (Phase 3 auto-assign).

**UC-2.6: View Project Details (Adaptive by Type)**
Each project type shows a different detail view:
- **Fixed**: Category breakdown — estimated vs actual hours (actual = summed from time entries matching each work category), burn rate, profitability (billed value − internal cost)
- **Retainer**: Current month usage (included + rollover vs used — "used" is always computed from time entries, never cached), overage, rollover balance, expiring hours warning, month-by-month history, active/inactive toggle
- **T&M**: Total hours logged, unbilled hours, total billed

All types share: task list for that project, team members.

**UC-2.7: Toggle Retainer Active/Inactive**
Admin can toggle a retainer's status. When inactive: not shown in project selector, no new monthly periods created, but existing data is preserved and existing tasks keep their assignment. Reactivating resumes normal behavior.

## Business Rules

- Currency set per client, inherited by all projects and rates
- Retainers run on calendar months (1st to last day)
- Retainer overage = hours beyond included + rollover, billed at overage rate
- Rollover hours carry forward for 3 months (hardcoded for v1), expired hours marked
- Warning indicator when retainer usage hits 80%+
- Warning when rollover hours are about to expire ("X hours expire end of month")
- Undo pattern: destructive actions (archive, status changes) use toast + undo with a 5-second delayed mutation. Only permanent deletes get a confirmation modal.

## Acceptance Criteria

- [ ] Admin can CRUD clients with all fields including currency
- [ ] Client archive cascades correctly (projects, tasks, timers) with 5-second undo toast
- [ ] All three project types can be created with correct type-specific fields
- [ ] Fixed project category estimates reference global work categories
- [ ] Default assignees per work category can be set on projects (workCategoryId → userId mappings)
- [ ] Project detail views adapt by type with correct data
- [ ] Retainer active/inactive toggle works with correct behavior
- [ ] First retainer usage period lazy-created on first access
- [ ] All monetary values display in client's currency
- [ ] Admin can manage global work categories (add, rename, archive)
- [ ] Work categories seeded with defaults on first setup
- [ ] Empty state shown on client list when no clients exist ("Create your first client to get started" with CTA)
- [ ] Empty state shown on project list when a client has no projects
