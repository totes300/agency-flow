# Retainer Hours Tracker — Implementation Spec

## Context for Claude Code

I'm adding a retainer hours tracking module to my existing NextJS + Convex application.
The project already has a project type called "Retainer."
I use ShadCN/ui for all components and Tailwind for styling.

**This module goes on the Project Detail page** for retainer-type projects.
When a user opens a retainer project, this is what they see — the live state
of hours, balances, and tasks. All values represent the current moment;
there is no "as of date" selector. It always shows the truth right now.

**Future phase (not in scope now):** This same data will also feed into a
Reports tab, where users can generate a point-in-time snapshot, export it
as CSV or PDF, and send it to the client. The compute logic and text
dictionary are designed to be reusable for that. But for now, only implement
the live Project Detail page view.

This spec defines the exact functionality, data model, computation logic, UX layout,
and every user-facing string. Implement this using my existing project conventions,
Convex schema, and ShadCN components. Match my app's existing design system — don't
hardcode colors or fonts.

**CRITICAL: Codebase first, spec second.** Before writing any code, read the existing
codebase to understand the project's conventions: Convex schema style, TypeScript
naming patterns, component organization, Tailwind usage, and how other features are
built. Then implement this spec USING those conventions. The spec describes WHAT to
build and the business logic. The HOW — field names, file locations, type naming,
query patterns — should all come from the existing codebase. If anything in this spec
conflicts with established project patterns, follow the project patterns.

There is a React prototype attached as a reference for layout and interaction patterns.
Use it as a wireframe — the structure and information hierarchy are final, but adapt
all styling to ShadCN + my Tailwind theme.

**Design inspiration: Google Workspace Admin billing page.** The accordion-style
monthly breakdown with expanding detail views comes directly from there. Study
the attached Google Admin screenshot for the general feel — collapsible month rows,
ending balances on each row, detailed transaction view when expanded.

### Filters

The top of the page needs a filter bar (similar to Google Admin's filter row):

- **Date range** — filter which months are visible (default: "All time")
  - Presets: "This cycle", "Last cycle", "Last 6 months", "This year", "All time"
  - Custom date range picker
- **Category** — filter tasks by category ("All", "Design", "Development", etc.)
  - This filters the task list inside expanded months AND recalculates subtotals
  - Month-level balances (started with, ending balance) are NOT affected by category filter
  - Only "Hours used" and task list reflect the filter

The compute function should accept optional filter parameters so the same logic
can serve both the live page and future report generation.

### Future: Export & Invoice Generation (prepare now, implement later)

This module will be extended with:

- **PDF export** — generate a formatted invoice/report for a selected period
- **CSV export** — raw data export of tasks + monthly summaries
- **Per-cycle or per-month reports** — snapshot that can be sent to the client
- **Documents section** — like Google Admin, each settled cycle will eventually
  show generated PDF/CSV documents attached to it

**What to prepare now:**
- The compute function should be callable with a specific date range (not just "all time")
  so it can generate a snapshot for any period
- The text dictionary (T object) should cover all strings so exports can reuse them
- ComputedMonth data should be serializable — no React components or DOM references
  in the computed data, pure data only
- Task list grouping by category should be a standalone utility (not embedded in JSX)
  so it can feed into PDF/CSV generators later

---

## 1. Data Requirements

**IMPORTANT: Do not copy these field names or structures verbatim.**
Look at the existing codebase first — match the project's naming conventions,
Convex schema patterns, and TypeScript type style. What follows describes
WHAT data is needed, not HOW to implement it.

### Retainer configuration (per project)

Each retainer project needs these settings (stored or derived from existing fields):

- **Link to the parent project** (however your schema references projects)
- **Monthly hours budget** — e.g. 10 hours per month
- **Hourly rate** — e.g. $80/h, used for extra hours invoicing
- **Rollover enabled** — boolean, set at project creation
- **Currency** — e.g. "USD"
- **Cycle start date** — when the first cycle began (needed for cycle alignment)

**Cycle length is fixed at 3 months (quarterly). Not configurable.**
Define as a constant, not a database field.

If rollover is ON → hours carry within 3-month cycles, settlement at cycle end.
If rollover is OFF → each month is standalone, settlement every month.

`rolloverEnabled` is a project-level setting, configured at project creation.
It is NOT a runtime toggle. It CAN be changed later in settings, but changing it
recomputes everything retroactively — warn the user.

### Task records

Each logged task needs:

- **Link to the parent project**
- **Date** — when the task was created (createdAt), not when it was completed
- **Category** — "Design", "Development", "Copywriting", etc.
- **Task name** — short title
- **Description** — detailed scope description
- **Hours** — logged time

**Month/cycle membership is always COMPUTED from the task date + config.**
Never stored as a field on the task.

### What is NOT stored

- No monthly balance records
- No cycle records
- No "settlement" or "cycle closed" records
- No cron jobs or triggers

The entire state is derived every time from: all tasks + config.
This is intentional — the system is always self-consistent.

---

## 2. Computation Logic

This is the core algorithm. Implement as a shared utility so both server queries
and client components can use it. Place it wherever your project keeps shared logic.

**The types and function signatures below are conceptual** — adapt naming
and structure to match your existing codebase conventions.

**The compute function must accept optional filter parameters:**
- `dateRange` — start/end month to limit output (but always compute FROM the start
  of the cycle containing the start date, so balances are correct)
- `categoryFilter` — when set, only affects task lists and "hours used" subtotals
  within each month. Does NOT affect balance calculations (those always use all tasks).

This design ensures the same function serves the live page, filtered views,
and future report/export generation.

### 2a. Cycle Assignment

The system needs to know which month belongs to which cycle. This is computed
from `cycleStartDate` + the fixed `CYCLE_LENGTH = 3`:

```typescript
const CYCLE_LENGTH = 3; // always 3 months, not configurable

// REFERENCE PSEUDOCODE — the algorithm is what matters, not the exact syntax.
// Adapt types, field names, and function signatures to your codebase.

// Given cycleStartDate = "2025-01-01":
//
// Cycle 1: Jan, Feb, Mar  (monthInCycle: 1, 2, 3)
// Cycle 2: Apr, May, Jun  (monthInCycle: 1, 2, 3)
// Cycle 3: Jul, Aug, Sep  (monthInCycle: 1, 2, 3)
// ...
//
// The formula:
// monthsSinceStart = (year - startYear) * 12 + (month - startMonth)
// cycleIndex       = Math.floor(monthsSinceStart / CYCLE_LENGTH)
// monthInCycle     = (monthsSinceStart % CYCLE_LENGTH) + 1
// isCycleStart     = monthInCycle === 1
// isCycleEnd       = monthInCycle === CYCLE_LENGTH

// Example implementation — use your own type names and field accessors
function getCycleInfo(yearMonth: string, config: /* your config type */) {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = /* config.cycleStartDate or equivalent */ .split("-").map(Number);
  const monthsSinceStart = (y - start[0]) * 12 + (m - start[1]);
  const monthInCycle = (monthsSinceStart % CYCLE_LENGTH) + 1;
  return {
    monthInCycle,
    isCycleStart: monthInCycle === 1,
    isCycleEnd: monthInCycle === CYCLE_LENGTH,
    cycleIndex: Math.floor(monthsSinceStart / CYCLE_LENGTH),
  };
}
```

This means:
- **Month 1 of any cycle**: balance resets to 0, fresh start
- **Month 2, 3, ...**: inherits balance from previous month
- **Last month of cycle**: settlement happens (extra invoiced or unused expires)
- **Month 1 of NEXT cycle**: balance is 0 again, regardless of what happened before

No event fires. No database write happens. The 4th month simply computes
`monthInCycle = 1`, so the balance formula starts from 0.

### 2b. Balance Computation

```typescript
// Conceptual shape — adapt field names to your conventions
type ComputedMonth = {
  period: string;              // "Jan 1 – 31, 2025"
  yearMonth: string;           // "2025-01"
  cycleIndex: number;          // 0, 1, 2, ... (for grouping)
  monthInCycle: number;        // 1, 2, or 3
  isCycleStart: boolean;
  isCycleEnd: boolean;
  tasks: Task[];
  worked: number;              // sum of task hours
  startBal: number;            // balance entering this month
  available: number;           // startBal + monthlyBudget (what you can use)
  endBal: number;              // available - worked
  extra: number;               // only at cycle end: abs(endBal) if negative
  unused: number;              // only at cycle end: endBal if positive
  settles: boolean;            // true if this month triggers settlement
};

// Main compute function — pseudocode, adapt to your types
function compute(tasks, config) {
  // 1. Group tasks by calendar month (yearMonth key: "2025-01")
  // 2. Determine all months from first task to current month
  // 3. For each month, call getCycleInfo() to get monthInCycle, isCycleStart, isCycleEnd
  // 4. Walk months chronologically, track running balance:

  let balance = 0;

  for (const month of months) {
    const cycleInfo = getCycleInfo(month.yearMonth, config);

    if (config.rolloverEnabled) {
      // CYCLE START → balance resets to 0, previous cycle's balance is gone
      if (cycleInfo.isCycleStart) balance = 0;

      const available = balance + config.monthlyBudgetHours;
      const worked = sumTaskHours(month.tasks);
      balance = available - worked;
      // balance now carries to next month (positive = saved, negative = borrowed)

      // CYCLE END → settlement
      if (cycleInfo.isCycleEnd) {
        month.extra = balance < 0 ? Math.abs(balance) : 0;  // invoice this
        month.unused = balance > 0 ? balance : 0;            // expires
        month.settles = true;
        // NOTE: balance is NOT reset here. It resets at NEXT cycle's start.
      }
    } else {
      // NO ROLLOVER → every month is independent
      const available = config.monthlyBudgetHours;
      const worked = sumTaskHours(month.tasks);
      balance = available - worked;
      month.extra = balance < 0 ? Math.abs(balance) : 0;
      month.unused = balance > 0 ? balance : 0;
      month.settles = true;
    }
  }
}
```

### Why there's no cron/trigger:

```
Cycle 1: Jan (monthInCycle=1) → Feb (2) → Mar (3, settles)
Cycle 2: Apr (monthInCycle=1) → May (2) → Jun (3, settles)
                ↑
                balance = 0 here, automatically
                because monthInCycle === 1
```

The "reset" is just an `if` statement in the compute function.
April doesn't need to "know" that March settled — it just sees
`isCycleStart === true` and starts from 0. The entire history
is recomputed every time from raw task data.

### Key rules:
- **No triggers, no events, no stored cycle state.** Cycle membership is computed
  from task dates + config. `monthInCycle` is derived: month 1 resets, last month settles.
  There is no "close cycle" action — recomputing at any time gives correct results.
- `monthInCycle = ((monthIndex - startMonth) % CYCLE_LENGTH) + 1`
- `isCycleStart = monthInCycle === 1` → resets balance to 0
- `isCycleEnd = monthInCycle === CYCLE_LENGTH` → computes extra/unused
- Balance resets to 0 at cycle start (this is what prevents carryover across cycles)
- Hours roll forward within a cycle (positive = saved, negative = borrowed)
- Settlement only at cycle end (rollover ON) or every month (rollover OFF)
- Extra hours beyond cycle pool are invoiced at hourlyRate
- Unused hours at cycle end expire — they don't carry to next cycle
- The 4th month doesn't "know" about the 3rd month's balance — it simply starts at 0
  because `isCycleStart === true`

---

## 3. Text Dictionary

Every user-facing string lives in one file: `lib/retainer-strings.ts`.
This makes i18n, A/B testing, and per-client customization trivial.

```typescript
export const T = {
  // Fixed labels (never change across months)
  startedWith:    "Started with",
  hoursUsed:      "Hours used",
  endingBalance:  "Ending balance",

  // Started-with subtitles (explain the number's composition)
  startBudgetOnly:     (b: number) => `${b}h budget`,
  startCycleStart:     (b: number) => `${b}h budget · cycle start`,
  startWithCarry:      (b: number, n: number) => `${b}h budget + ${n}h from last month`,
  startWithDeduction:  (b: number, n: number) => `${b}h budget – ${n}h from last month`,
  startNoRollover:     (b: number) => `${b}h monthly budget`,

  // Hours-used subtitle
  tasksCompleted: (n: number) => `${n} task${n !== 1 ? "s" : ""} completed`,

  // Ending-balance subtitles
  carriesOver:     "Carries over",
  deductedNext:    "Deducted next month",
  allUsed:         "All hours used",
  paymentDue:      "Payment due",
  notCarriedOver:  "Not carried over",
  notUsed:         "Not used",
  noExtraCharges:  "No extra charges",

  // Row tags (collapsed month rows)
  tagCarries:      (n: number) => `${n}h carries`,       // with +/– prefix
  tagOver:         (n: number) => `${n}h over`,
  tagUnused:       (n: number) => `${n}h unused`,
  tagOnBudget:     "on budget",
  tagCycleClosed:  "cycle closed",
  tagPaymentDue:   (n: number) => `+${n}h · payment due`,

  // Settlement block
  extraHoursLabel: (range: string) => `${range} · Extra hours`,
  extraExplainCycle:  (used: number, extra: number, pool: number) =>
    `${used}h used this cycle — ${extra}h more than the ${pool}h included.`,
  extraExplainMonth:  (used: number, extra: number, budget: number) =>
    `${used}h used — ${extra}h more than the ${budget}h included.`,
  extraInvoice:    "Extra hours invoice",
  extraCalc:       (n: number, rate: number) => `${n} hours × $${rate}/h`,
  unusedCycle:     (n: number) => `${n}h not used this cycle. Balance resets for the next cycle.`,
  unusedMonth:     (n: number) => `${n}h not used. Next month starts fresh.`,

  // Dashboard
  currentCycle:    (range: string) => `Current cycle · ${range}`,
  thisMonth:       "This month",
  hoursUsedLabel:  "hours used",
  remaining:       "remaining",
  overBudget:      "over budget",
  fullyUsed:       "fully used",

  // Filters
  allTime:         "All time",
  thisCycle:       "This cycle",
  lastCycle:       "Last cycle",
  last6Months:     "Last 6 months",
  thisYear:        "This year",
  allCategories:   "All categories",
};
```

---

## 4. Component Hierarchy

```
RetainerView (main page component)
├── RetainerHeader
│   ├── Project name
│   ├── Config summary: "{budget}h/month · ${rate}/h" + (rollover ? " · 3-month cycles" : "")
│   └── Mode indicator: "Rollover enabled" or "Monthly settlement" (read-only, links to settings)
│
├── FilterBar
│   ├── Date range selector (presets + custom range)
│   └── Category filter (multi-select, "All" default)
│
├── CycleDashboard (hero card for current cycle)
│   ├── Top section:
│   │   ├── Left: cycle date range label + fraction "{used} / {budget} hours used"
│   │   └── Right: remaining badge "{n}h remaining" or "–{n}h over budget"
│   └── Bottom section (rollover only): month-by-month mini-cards
│       └── Per month: name, hours logged, "of {available} / {budget}h available", status tag
│
├── MonthList (accordion list, newest first)
│   └── MonthRow (repeated)
│       ├── Collapsed: date | cycle badge | "{n}h logged" | status tag
│       └── Expanded:
│           ├── ThreeBoxSummary
│           │   ├── "Started with" — available hours + composition subtitle
│           │   ├── "Hours used" — logged hours + task count
│           │   └── "Ending balance" — +/– balance + what happens next
│           ├── TaskList (grouped by category)
│           │   └── CategoryGroup (repeated)
│           │       ├── Category header + subtotal
│           │       └── TaskRow: date | name | description | hours
│           └── SettlementBlock (conditional, cycle-end only)
│               ├── Extra hours: explanation + invoice card
│               └── Unused hours: info message
│
└── Footer: config summary
```

---

## 5. Layout & UX Decisions (Final)

These decisions have been user-tested through 10 iterations. Don't change them.

### Filter bar
- Sits between the header and the cycle dashboard
- Style: follow Google Admin's filter row — horizontal, compact, dropdown selects
- **Date range**: dropdown with presets + "Custom" option that opens a date picker
  - Default: "All time"
  - When filtered: only show months within the range, but cycle dashboard always
    shows the current cycle regardless of filter
- **Category**: multi-select dropdown
  - Default: "All categories"
  - When filtered: task lists and "Hours used" numbers reflect the filter.
    "Started with" and "Ending balance" are NOT affected — they always show
    the full picture. This prevents confusion about where the balance comes from.
- Show active filter count or clear-all button when filters are applied

### Collapsed month rows
- Left side (one line): arrow chevron → date range → cycle date badge → "Xh logged"
- Right side: single status tag
- Tag logic:
  - Mid-cycle positive: "+{n}h carries" (green)
  - Mid-cycle negative: "–{n}h carries" (red/muted)
  - Cycle-end with extra: "+{n}h · payment due" (red/muted)
  - Cycle-end with unused: "{n}h unused" (amber/muted)
  - Cycle-end on budget: "on budget" (green)
  - Rollover OFF positive: "{n}h unused" (amber)
  - Rollover OFF negative: "{n}h over" (red/muted)

### Three-box summary (expanded)
- Labels are FIXED across all months: "Started with" | "Hours used" | "Ending balance"
- Never change these labels based on state — consistency enables comparison
- "Started with" = available hours (budget + carryover), subtitle explains composition
- "Ending balance" always shows +/– prefix for clarity
- Subtle background color hints: positive=green-tint, negative=red-tint, zero=neutral

### Task list
- Grouped by category (Design, Development, Copywriting, etc.)
- Category header shows name + subtotal hours
- Table-like columns: date (42px) | task name (200px) | description (flex) | hours (30px)
- Total row at bottom with top border

### Settlement block
- Only appears at cycle-end months (rollover ON) or every month (rollover OFF)
- Calm, not alarming — use subtle backgrounds, not harsh colors
- Shows: explanation text → invoice card with calculation and total amount

### Cycle dashboard (top of page)
- Shows current cycle only
- Left: "CURRENT CYCLE · {date range}" + big fraction "{used} / {budget} hours used"
- Right: remaining hours badge with color
- Bottom row (rollover ON): per-month mini breakdown cards
  - Each shows: month name, hours logged, "of {available} / {budget}h available", status tag

### Rollover mode indicator
- Read-only display in the header: "Rollover enabled" or "Monthly settlement"
- Optionally link to project settings for editing
- Rollover setting is configured at project creation, not toggled in the tracker UI
- If changed in project settings, show confirmation dialog warning that all
  historical data will be recomputed

---

## 6. Design Principles

- **Notion/Linear aesthetic**: muted semantic colors, never shouty. No bright reds or greens.
- **All numbers use tabular-nums** for alignment
- **Minimal borders**: 1px, subtle gray, only where needed for structure
- **Typography hierarchy**: small uppercase labels → large numbers → small context text
- **No progress bars** — plain numbers with context text
- **Negative values always show –prefix, positive show +prefix** on ending balances
- **Enterprise-ready**: scannable, comparable across months, zero ambiguity

**Note on pixel values and sizes:** Any specific pixel values, font sizes, widths,
or spacing mentioned in this spec or in the prototype JSX are indicative only —
they represent the intended visual hierarchy and proportions. Override them freely
to match the project's existing Tailwind theme and ShadCN component sizing.
The information hierarchy and layout structure are final; the exact measurements are not.

---

## 7. Required Operations

Implement these using your existing Convex patterns (queries, mutations, actions).
Don't create new patterns — follow what the codebase already does.

**Reads:**
- Get retainer config for a project
- Get all tasks for a project (optionally filtered by date range)
- Get computed months for a project (runs the compute logic server-side)
  - Must accept optional date range and category filter parameters

**Writes:**
- Create/update retainer config (happens at project creation + settings)
- Add a task
- Update/delete a task

**Standalone utilities** (not embedded in components — reusable for exports):
- Compute function (balance logic)
- Group tasks by category (with subtotals)
- Format month data for display (period labels, date ranges)

**The compute function should run server-side** in a Convex query so the client
receives pre-computed data. Don't send raw tasks to the client and compute there.

---

## 8. Integration with Project Creation Flow

When creating a new project with type "Retainer", the creation form should include:

**Retainer-specific fields:**
- Monthly hours budget (number input, required)
- Hourly rate (number input, required)
- Rollover enabled (checkbox/switch — default ON)
  - If ON: "Hours roll over within 3-month cycles. Settlement at cycle end."
  - If OFF: "Each month settles independently. No rollover."
- Cycle start date (date picker — defaults to 1st of current month)
- Currency (select — default USD)

These fields create the retainer config record linked to the project.

**In project settings (edit after creation):**
- All fields are editable
- Changing the rollover setting on a project with existing tasks
  should show a confirmation dialog:
  > "This will recompute all historical balances and settlement amounts. Continue?"
- Changing the budget or rate should clarify:
  > "This applies to all months. For mid-project rate changes, contact support."
  (Future: support per-period rate overrides)

---

## 9. File Organization

**Follow the project's existing file organization patterns.** The module needs:

1. **Compute logic** — pure function, no framework dependencies, shareable
   between server and client. Put it where the project keeps shared utilities.
   Must be serializable output (plain objects, no JSX) so it can feed into
   PDF/CSV generators in the future.
2. **Text dictionary** — all user-facing strings in one place. Same location pattern.
   Exports will reuse these strings.
3. **Utility functions** — category grouping, date formatting, filter logic.
   Keep these separate from UI components so export generators can reuse them.
4. **Database layer** — queries and mutations. Follow existing Convex file organization.
5. **UI components** — the component tree from §4. Follow existing component
   organization (flat folder, nested folders, whatever the project does).

Don't create new organizational patterns. Look at how existing features are structured
and follow the same approach.

---

## Reference

The attached `retainer_mockup_v10.jsx` is a working React prototype.
Use it to understand the exact interaction patterns, but rebuild everything
with ShadCN components and my existing Tailwind theme. The prototype has
inline styles — convert these to Tailwind classes.

Key files:
- v9 = clean version without task descriptions (fallback)
- v10 = with category grouping and task descriptions (target)
