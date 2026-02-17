# Retainer Hours Tracker — Implementation Plan

## Context

The existing retainer project detail page (`components/project-detail-retainer.tsx`) shows basic usage stats, warnings, and a simple monthly history table. The spec calls for a complete replacement: a Google Workspace Admin-inspired view with cycle dashboards, accordion month rows, three-box summaries, category-grouped task lists, settlement blocks, and filters.

The core architectural change: instead of the existing `retainerPeriods` table approach (lazy-created period records with stored rollover), the new view derives **everything** from raw time entries + project config every time. No stored cycle/balance state. The existing `retainerPeriods` system stays intact (used by billing/timesheets) — the new compute runs alongside it.

## Existing Patterns Being Followed

- **Convex shared logic**: `convex/lib/permissions.ts` pattern → `convex/lib/retainerCompute.ts`
- **Format helpers**: `lib/format.ts` (formatDuration, formatCurrency) — reused as-is
- **Component structure**: flat `components/` directory (no subdirectories)
- **Data fetching**: `useQuery(api.x.y, args)` with loading/null checks
- **Dynamic imports**: `dynamic(() => import(...))` for code splitting on detail page
- **shadcn/ui components**: Card, Badge, Table, Collapsible, Accordion, Select, Button, Popover, Calendar
- **Duration storage**: integer minutes everywhere, display via `formatDuration()`
- **Role checks**: `isAdmin(user)` in Convex queries to hide billing data from members

## Key Decisions

1. **Units**: Compute function works in **minutes** (matching codebase). A `minutesToHours(m)` helper rounds to 1 decimal for display. The T strings accept formatted hour values.
2. **Schema addition**: `rolloverEnabled: v.optional(v.boolean())` on projects table. Existing `startDate` field serves as cycle start date.
3. **Server-side compute**: The query in `convex/retainerView.ts` runs the compute function and returns pre-computed `ComputedMonth[]` data to the client. No client-side recomputation.
4. **Coexistence**: The existing `retainerPeriods` table/queries remain untouched. The new retainer view is a parallel system reading from time entries directly.
5. **Component naming**: `retainer-view.tsx`, `retainer-cycle-dashboard.tsx`, `retainer-filter-bar.tsx`, `retainer-month-row.tsx` — all flat in `components/`.

---

## Chunks

- [x] **Chunk 1: Pure compute utilities + text dictionary**
  - **Creates:** `convex/lib/retainerCompute.ts`, `lib/retainer-strings.ts`, `convex/lib/retainerCompute.test.ts`
  - **Modifies:** none
  - **Implements:**
    - `CYCLE_LENGTH = 3` constant
    - `getCycleInfo(yearMonth, cycleStartDate)` → `{ monthInCycle, isCycleStart, isCycleEnd, cycleIndex }`
    - `computeRetainerMonths(config, tasksByMonth)` → `ComputedMonth[]` — the core balance algorithm from spec §2b, working in minutes
    - `groupTasksByCategory(tasks, categoryMap)` → `{ categoryName, tasks, totalMinutes }[]` — standalone utility for reuse in exports
    - `getMonthRange(yearMonth)`, `getAllMonthsBetween(first, last)` — date helpers
    - `minutesToHours(minutes)` — rounds to 1 decimal (e.g., 90 → 1.5, 600 → 10)
    - Full `T` text dictionary from spec §3, adapted to take formatted hour strings
    - `getStatusTag(month, rolloverEnabled)` — returns `{ label, variant }` for collapsed row tags
    - `getStartedWithSubtitle(month, budget, rolloverEnabled)` and `getEndingBalanceSubtitle(month, rolloverEnabled)` — encapsulate the subtitle logic from the prototype
    - Vitest tests: cycle assignment math, balance computation (rollover on/off), settlement logic, edge cases (zero hours, exact budget, negative carryover)
  - **Depends on:** none
  - **Verify:** `npx vitest run convex/lib/retainerCompute.test.ts` — all tests pass

- [x] **Chunk 2: Schema + Convex backend query**
  - **Creates:** `convex/retainerView.ts`
  - **Modifies:** `convex/schema.ts`, `convex/projects.ts`, `components/project-form-dialog.tsx`
  - **Implements:**
    - Add `rolloverEnabled: v.optional(v.boolean())` to projects table in schema
    - Update `projects.create` and `projects.update` mutations to accept/store `rolloverEnabled`
    - Update project form dialog: add Switch for "Rollover enabled" under retainer fields, with helper text ("Hours roll over within 3-month cycles" vs "Each month settles independently"), default ON
    - New `retainerView.getComputedView` query:
      - Accepts `projectId`, optional `dateRangeStart`, `dateRangeEnd`, `categoryFilter` (array of workCategoryIds)
      - Fetches project config + all tasks with time entries for the project
      - Groups time entries by yearMonth, builds task records (taskId, title, date, categoryId, categoryName, minutes)
      - Calls `computeRetainerMonths()` from Chunk 1
      - Applies category filter to task lists + recalculates filtered hours (but NOT balances)
      - Returns: `{ config, months: ComputedMonth[], currentCycleIndex, categories }` — all pre-computed
      - Admin-only: includes `overageRate` in config
    - New `retainerView.getFilterOptions` query: returns available year-months and work categories for the filter bar
  - **Depends on:** Chunk 1
  - **Verify:** Run `npx convex dev` to validate schema migration. Test query via Convex dashboard with a retainer project that has time entries.

- [x] **Chunk 3: UI — MonthRow (ThreeBoxSummary + TaskList + SettlementBlock)**
  - **Creates:** `components/retainer-month-row.tsx`
  - **Modifies:** none
  - **Implements:**
    - `RetainerMonthRow` component using shadcn Accordion item pattern (or Collapsible)
    - **Collapsed state**: period label, cycle badge (rollover only), "{X}h logged", status tag (Badge with semantic color)
    - **Expanded state**:
      - Three-box summary: "Started with" | "Hours used" | "Ending balance" — using Card with subtle background tints
      - Subtitles computed via helper functions from Chunk 1 (T strings)
      - Task list grouped by category: category header with subtotal, task rows (date, name, description, hours), total row
      - Settlement block (conditional): extra hours explanation + invoice card, or unused hours info
    - All numbers use `tabular-nums` class, durations formatted via `minutesToHours()`
    - Follows Notion/Linear aesthetic: muted semantic colors via Tailwind theme tokens (`text-muted-foreground`, `bg-muted`, etc.)
  - **Depends on:** Chunk 1 (types + T strings)
  - **Verify:** Renders correctly when passed mock `ComputedMonth` data with various states (positive balance, negative, settlement, zero)

- [x] **Chunk 4: UI — CycleDashboard + FilterBar**
  - **Creates:** `components/retainer-cycle-dashboard.tsx`, `components/retainer-filter-bar.tsx`
  - **Modifies:** none
  - **Implements:**
    - **CycleDashboard**: Card with:
      - Top section: cycle range label + "{used} / {budget} hours used" big numbers + remaining hours badge
      - Bottom section (rollover only): per-month mini-cards showing month name, hours logged, available breakdown, status tag
    - **FilterBar**: horizontal bar with:
      - Date range Select with presets ("All time", "This cycle", "Last cycle", "Last 6 months", "This year") + "Custom" option that opens Popover with Calendar date range picker
      - Category multi-select using Popover + Checkbox list pattern
      - Active filter count indicator + "Clear" button
    - Both components receive data as props (no direct Convex queries — data comes from parent)
  - **Depends on:** Chunk 1 (types + T strings)
  - **Verify:** Components render with mock data; filter state changes are reflected in callbacks

- [x] **Chunk 5: RetainerView assembly + integration**
  - **Creates:** `components/retainer-view.tsx`
  - **Modifies:** `components/project-detail-retainer.tsx`, `app/(dashboard)/projects/[id]/page.tsx`
  - **Implements:**
    - `RetainerView`: main container that:
      - Calls `useQuery(api.retainerView.getComputedView, { projectId, ...filters })`
      - Manages filter state (date range, category)
      - Renders: FilterBar → CycleDashboard → MonthList (Accordion with MonthRow items, newest first)
      - Loading skeleton while query loads
      - Footer with config summary
    - Replace `RetainerProjectDetail` content: it becomes a thin wrapper that renders `RetainerView` (keeping the same export name/interface so the dynamic import in the page doesn't change)
    - Update props passed from project detail page if needed (e.g., add `startDate`, `rolloverEnabled`)
  - **Depends on:** Chunks 1–4
  - **Verify:**
    1. Navigate to a retainer project detail page — see the new retainer view
    2. Expand month rows — three-box summary, task list, settlement block render correctly
    3. Apply date range filter — month list filters appropriately
    4. Apply category filter — task lists and "hours used" numbers filter, balances don't change
    5. Toggle between retainer projects with rollover on/off — different display modes
    6. Non-admin users don't see overage rates or billing amounts
    7. Check shadcn audit: all components from registry, no hand-rolled UI
