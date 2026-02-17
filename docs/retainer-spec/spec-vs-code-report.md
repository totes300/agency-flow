# Retainer Spec vs Code — Line-by-Line Audit

Generated: 2026-02-16

---

## §1 Data Requirements

### Retainer configuration (per project)

| Requirement | Status | Location |
|---|---|---|
| Link to parent project | ✅ | `convex/schema.ts:67` — `clientId: v.id("clients")` on projects table |
| Monthly hours budget | ✅ | `convex/schema.ts:73` — `includedHoursPerMonth: v.optional(v.number())` (stored as minutes despite name) |
| Hourly rate (overage) | ✅ | `convex/schema.ts:74` — `overageRate: v.optional(v.number())` |
| Rollover enabled (boolean) | ✅ | `convex/schema.ts:76` — `rolloverEnabled: v.optional(v.boolean())` |
| Currency | ✅ | Inherited from client — `convex/schema.ts:61` (`clients.currency`) |
| Cycle start date | ✅ | `convex/schema.ts:75` — `startDate: v.optional(v.string())` (serves as cycle anchor) |
| Cycle length fixed at 3 months, defined as constant | ✅ | `convex/lib/retainerCompute.ts:7` — `CYCLE_LENGTH = 3` |
| rolloverEnabled set at project creation | ✅ | `components/project-form-dialog.tsx:647-663` — Switch in form, defaults true |
| Rollover ON: carry within 3-month cycles | ✅ | `convex/lib/retainerCompute.ts:199-232` |
| Rollover OFF: monthly settlement | ✅ | `convex/lib/retainerCompute.ts:233-254` |

### Task records

| Requirement | Status | Location |
|---|---|---|
| Link to parent project | ✅ | `convex/lib/retainerCompute.ts:25` — `TaskRecord.taskId` (fetched via project index in `retainerView.ts:43-46`) |
| Date (createdAt) | ✅ | `convex/lib/retainerCompute.ts:28` — `date: string` |
| Category | ✅ | `convex/lib/retainerCompute.ts:29-30` — `workCategoryId?`, `workCategoryName?` |
| Task name | ✅ | `convex/lib/retainerCompute.ts:27` — `title: string` |
| Description | ✅ | `convex/lib/retainerCompute.ts:28` — `description?: string` |
| Hours (logged time) | ✅ | `convex/lib/retainerCompute.ts:31` — `durationMinutes: number` |
| Month membership computed, never stored | ✅ | Computed in `computeRetainerMonths` via date grouping — no month field on tasks |

### What is NOT stored

| Requirement | Status | Location |
|---|---|---|
| No monthly balance records | ✅ | No balance fields in schema |
| No cycle records | ✅ | No cycle table in schema |
| No settlement/cycle-closed records | ✅ | Computed in `retainerCompute.ts` only |
| No cron jobs or triggers | ✅ | No scheduled functions for retainer |
| State derived from tasks + config every time | ✅ | `convex/retainerView.ts:93` calls `computeRetainerMonths()` on every query |

> **NOTE:** `convex/retainerPeriods.ts` defines a `retainerPeriods` table (schema line 216-224) and a lazy-creation system that **contradicts** this requirement. The table stores `includedMinutes` and `rolloverMinutes` per period. However, the active retainer UI (`retainerView.ts`) does NOT use this table — it purely computes from time entries. The `retainerPeriods` module appears to be legacy/unused.

---

## §2 Computation Logic

### 2a. Cycle Assignment

| Requirement | Status | Location |
|---|---|---|
| `CYCLE_LENGTH = 3` constant | ✅ | `convex/lib/retainerCompute.ts:7` |
| `monthsSinceStart = (year - startYear) * 12 + (month - startMonth)` | ✅ | `retainerCompute.ts:154` |
| `cycleIndex = Math.floor(monthsSinceStart / CYCLE_LENGTH)` | ✅ | `retainerCompute.ts:156` |
| `monthInCycle = (monthsSinceStart % CYCLE_LENGTH) + 1` | ✅ | `retainerCompute.ts:155` — with positive-wrap: `(((ms % CL) + CL) % CL) + 1` |
| `isCycleStart = monthInCycle === 1` | ✅ | `retainerCompute.ts:158` |
| `isCycleEnd = monthInCycle === CYCLE_LENGTH` | ✅ | `retainerCompute.ts:159` |
| Month 1: balance resets to 0 | ✅ | `retainerCompute.ts:201` — `if (cycleInfo.isCycleStart) balance = 0;` |
| No event fires, no DB write — just an if statement | ✅ | Pure computation only |

### 2b. Balance Computation

| Requirement | Status | Location |
|---|---|---|
| `ComputedMonth.period` | ✅ | `retainerCompute.ts:36` |
| `ComputedMonth.yearMonth` | ✅ | `retainerCompute.ts:37` |
| `ComputedMonth.cycleIndex` | ✅ | `retainerCompute.ts:38` |
| `ComputedMonth.monthInCycle` | ✅ | `retainerCompute.ts:39` |
| `ComputedMonth.isCycleStart` | ✅ | `retainerCompute.ts:40` |
| `ComputedMonth.isCycleEnd` | ✅ | `retainerCompute.ts:41` |
| `ComputedMonth.tasks` | ✅ | `retainerCompute.ts:42` |
| `ComputedMonth.worked` (hours worked) | ✅ | `retainerCompute.ts:43` — named `workedMinutes` (convention: minutes) |
| `ComputedMonth.startBal` | ✅ | `retainerCompute.ts:44` — named `startBalance` |
| `ComputedMonth.available` | ✅ | `retainerCompute.ts:45` — named `availableMinutes` |
| `ComputedMonth.endBal` | ✅ | `retainerCompute.ts:46` — named `endBalance` |
| `ComputedMonth.extraMinutes` | ✅ | `retainerCompute.ts:47` |
| `ComputedMonth.unusedMinutes` | ✅ | `retainerCompute.ts:48` |
| `ComputedMonth.settles` | ✅ | `retainerCompute.ts:49` |

#### Rollover ON path

| Requirement | Status | Location |
|---|---|---|
| Cycle start → balance resets to 0 | ✅ | `retainerCompute.ts:201` |
| `available = balance + monthlyBudget` | ✅ | `retainerCompute.ts:204` |
| `balance = available - worked` | ✅ | `retainerCompute.ts:205` |
| Balance carries to next month within cycle | ✅ | Balance variable persists across loop iterations |
| Cycle end: `extra = abs(balance) if negative` | ✅ | `retainerCompute.ts:213` |
| Cycle end: `unused = balance if positive` | ✅ | `retainerCompute.ts:214` |
| Cycle end: `settles = true` | ✅ | `retainerCompute.ts:215` |
| Mid-cycle: extra=0, unused=0, settles=false | ✅ | `retainerCompute.ts:218-225` |
| Balance NOT reset at cycle end (resets at NEXT cycle start) | ✅ | Reset only in `isCycleStart` block (line 201), not in `isCycleEnd` |

#### Rollover OFF path

| Requirement | Status | Location |
|---|---|---|
| `available = monthlyBudget` (no carry) | ✅ | `retainerCompute.ts:235` |
| Every month settles | ✅ | `retainerCompute.ts:251` — `settles: true` |
| `extra` and `unused` computed per month | ✅ | `retainerCompute.ts:250-251` |

#### Filter parameters

| Requirement | Status | Location |
|---|---|---|
| `dateRange` filter | ✅ | `convex/retainerView.ts:22-23` — `dateRangeStart?`, `dateRangeEnd?` args |
| Compute from start of cycle containing start date | ⚠️ PARTIAL | `retainerView.ts:93` computes ALL months, then filters (lines 96-101). Balances are correct because computation is unfiltered, but filtering happens post-compute rather than passing range to compute function. |
| `categoryFilter` — only affects task lists and hours used | ✅ | `retainerView.ts:104-126` — replaces tasks and workedMinutes, keeps balances unchanged |
| Category filter does NOT affect balance | ✅ | `retainerView.ts:104-126` — only modifies `tasks` and `workedMinutes` per month |

#### Standalone utilities

| Requirement | Status | Location |
|---|---|---|
| Compute function (balance logic) | ✅ | `retainerCompute.ts:174` — `computeRetainerMonths()` |
| Group tasks by category (standalone) | ✅ | `retainerCompute.ts:266` — `groupTasksByCategory()` |
| Format month data for display | ✅ | `retainerCompute.ts:136` — `formatPeriodLabel()` |
| Compute runs server-side (Convex query) | ✅ | `convex/retainerView.ts:93` — called inside query handler |
| Output is serializable (no JSX) | ✅ | `ComputedMonth` is plain data |

---

## §3 Text Dictionary — T keys

### Fixed labels

| T Key | Spec String | Code String | Location | Used in UI? |
|---|---|---|---|---|
| `startedWith` | `"Started with"` | `"Started with"` | `retainer-strings.ts:8` | ✅ `retainer-month-row.tsx:252` |
| `hoursUsed` | `"Hours used"` | `"Hours used"` | `retainer-strings.ts:9` | ✅ `retainer-month-row.tsx:266` |
| `endingBalance` | `"Ending balance"` | `"Ending balance"` | `retainer-strings.ts:10` | ✅ `retainer-month-row.tsx:280` |

### Started-with subtitles

| T Key | Spec String | Code String | Location | Used in UI? |
|---|---|---|---|---|
| `startBudgetOnly` | `` `${b}h budget` `` | `` `${b}h budget` `` | `retainer-strings.ts:13` | ✅ Imported from `T` in `retainerCompute.ts:419` |
| `startCycleStart` | `` `${b}h budget · cycle start` `` | `` `${b}h budget · cycle start` `` | `retainer-strings.ts:14` | ✅ Imported from `T` in `retainerCompute.ts:411` |
| `startWithCarry` | `` `${b}h budget + ${n}h from last month` `` | `` `${b}h budget + ${n}h from last month` `` | `retainer-strings.ts:15` | ✅ Imported from `T` in `retainerCompute.ts:414` |
| `startWithDeduction` | `` `${b}h budget – ${n}h from last month` `` | `` `${b}h budget – ${n}h from last month` `` | `retainer-strings.ts:16-17` | ✅ Imported from `T` in `retainerCompute.ts:417` |
| `startNoRollover` | `` `${b}h monthly budget` `` | `` `${b}h monthly budget` `` | `retainer-strings.ts:18` | ✅ Imported from `T` in `retainerCompute.ts:408` |

### Hours-used subtitle

| T Key | Spec String | Code String | Location | Used in UI? |
|---|---|---|---|---|
| `tasksCompleted` | `` `${n} task${n !== 1 ? "s" : ""} completed` `` | `` `${n} task${n !== 1 ? "s" : ""} completed` `` | `retainer-strings.ts:21` | ✅ `retainer-month-row.tsx:273` |

### Ending-balance subtitles

| T Key | Spec String | Code String | Location | Used in UI? |
|---|---|---|---|---|
| `carriesOver` | `"Carries over"` | `"Carries over"` | `retainer-strings.ts:24` | ⚠️ NOT directly — duplicated at `retainerCompute.ts:399` |
| `deductedNext` | `"Deducted next month"` | `"Deducted next month"` | `retainer-strings.ts:25` | ⚠️ NOT directly — duplicated at `retainerCompute.ts:400` |
| `allUsed` | `"All hours used"` | `"All hours used"` | `retainer-strings.ts:26` | ⚠️ NOT directly — duplicated at `retainerCompute.ts:401` |
| `paymentDue` | `"Payment due"` | `"Payment due"` | `retainer-strings.ts:27` | ⚠️ NOT directly — duplicated at `retainerCompute.ts:389,395` |
| `notCarriedOver` | `"Not carried over"` | `"Not carried over"` | `retainer-strings.ts:28` | ⚠️ NOT directly — duplicated at `retainerCompute.ts:394` |
| `notUsed` | `"Not used"` | `"Not used"` | `retainer-strings.ts:29` | ⚠️ NOT directly — duplicated at `retainerCompute.ts:388` |
| `noExtraCharges` | `"No extra charges"` | `"No extra charges"` | `retainer-strings.ts:30` | ⚠️ NOT directly — duplicated at `retainerCompute.ts:390,396` |

### Row tags

| T Key | Spec String | Code String | Location | Used in UI? |
|---|---|---|---|---|
| `tagCarries` | `` `${n}h carries` `` | `` `${n}h carries` `` | `retainer-strings.ts:33` | ⚠️ NOT directly — duplicated in `getStatusTag` at `retainerCompute.ts:331,334` |
| `tagOver` | `` `${n}h over` `` | `` `${n}h over` `` | `retainer-strings.ts:34` | ⚠️ NOT directly — duplicated at `retainerCompute.ts:342` |
| `tagUnused` | `` `${n}h unused` `` | `` `${n}h unused` `` | `retainer-strings.ts:35` | ⚠️ NOT directly — duplicated at `retainerCompute.ts:323,348` |
| `tagOnBudget` | `"on budget"` | `"on budget" as const` | `retainer-strings.ts:36` | ⚠️ NOT directly — duplicated at `retainerCompute.ts:327,336,352` |
| `tagCycleClosed` | `"cycle closed"` | `"cycle closed" as const` | `retainer-strings.ts:37` | ❌ **NEVER USED** — not in `getStatusTag` or any UI component |
| `tagPaymentDue` | `` `+${n}h · payment due` `` | `` `+${n}h · payment due` `` | `retainer-strings.ts:38` | ⚠️ NOT directly — duplicated at `retainerCompute.ts:317` |

### Settlement block

| T Key | Spec String | Code String | Location | Used in UI? |
|---|---|---|---|---|
| `extraHoursLabel` | `` `${range} · Extra hours` `` | `` `${range} · Extra hours` `` | `retainer-strings.ts:41` | ✅ `retainer-month-row.tsx:329` |
| `extraExplainCycle` | `` `${used}h used this cycle — ${extra}h more than the ${pool}h included.` `` | matches | `retainer-strings.ts:42-43` | ✅ `retainer-month-row.tsx:333` |
| `extraExplainMonth` | `` `${used}h used — ${extra}h more than the ${budget}h included.` `` | matches | `retainer-strings.ts:44-45` | ✅ `retainer-month-row.tsx:334` |
| `extraInvoice` | `"Extra hours invoice"` | `"Extra hours invoice"` | `retainer-strings.ts:46` | ✅ `retainer-month-row.tsx:341` |
| `extraCalc` | `` `${n} hours × $${rate}/h` `` | `` `${n} hours × $${rate}/h` `` | `retainer-strings.ts:47` | ✅ `retainer-month-row.tsx:343` |
| `unusedCycle` | `` `${n}h not used this cycle. Balance resets for the next cycle.` `` | matches | `retainer-strings.ts:48-49` | ✅ `retainer-month-row.tsx:209` |
| `unusedMonth` | `` `${n}h not used. Next month starts fresh.` `` | matches | `retainer-strings.ts:50` | ✅ `retainer-month-row.tsx:210` |

### Dashboard

| T Key | Spec String | Code String | Location | Used in UI? |
|---|---|---|---|---|
| `currentCycle` | `` `Current cycle · ${range}` `` | `` `Current cycle · ${range}` `` | `retainer-strings.ts:53` | ✅ `retainer-cycle-dashboard.tsx:61` |
| `thisMonth` | `"This month"` | `"This month"` | `retainer-strings.ts:54` | ✅ `retainer-cycle-dashboard.tsx:62`, `retainer-filter-bar.tsx:251` |
| `hoursUsedLabel` | `"hours used"` | `"hours used"` | `retainer-strings.ts:55` | ✅ `retainer-cycle-dashboard.tsx:77` |
| `remaining` | `"remaining"` | `"remaining"` | `retainer-strings.ts:56` | ✅ `retainer-cycle-dashboard.tsx:58` |
| `overBudget` | `"over budget"` | `"over budget"` | `retainer-strings.ts:57` | ✅ `retainer-cycle-dashboard.tsx:55` |
| `fullyUsed` | `"fully used"` | `"fully used"` | `retainer-strings.ts:58` | ✅ `retainer-cycle-dashboard.tsx:57` |

### Filters

| T Key | Spec String | Code String | Location | Used in UI? |
|---|---|---|---|---|
| `allTime` | `"All time"` | `"All time"` | `retainer-strings.ts:61` | ✅ `retainer-filter-bar.tsx:250` |
| `thisCycle` | `"This cycle"` | `"This cycle"` | `retainer-strings.ts:62` | ✅ `retainer-filter-bar.tsx:251` |
| `lastCycle` | `"Last cycle"` | `"Last cycle"` | `retainer-strings.ts:63` | ✅ `retainer-filter-bar.tsx:252` |
| `last6Months` | `"Last 6 months"` | `"Last 6 months"` | `retainer-strings.ts:64` | ✅ `retainer-filter-bar.tsx:253` |
| `thisYear` | `"This year"` | `"This year"` | `retainer-strings.ts:65` | ✅ `retainer-filter-bar.tsx:254` |
| `allCategories` | `"All categories"` | `"All categories"` | `retainer-strings.ts:66` | ✅ `retainer-filter-bar.tsx:261` |

---

## §4 Component Hierarchy

| Spec Component | Status | Location |
|---|---|---|
| `RetainerView` (main page component) | ✅ | `components/retainer-view.tsx` (227 lines) |
| `├── RetainerHeader` (project name, config summary, mode indicator) | ✅ | Inline in `retainer-view.tsx:140-161` (no separate component) |
| `│   ├── Config summary: "{budget}h/month · ${rate}/h"` | ✅ | `retainer-view.tsx:144-151` |
| `│   └── Mode indicator: "Rollover enabled" / "Monthly settlement"` | ✅ | `retainer-view.tsx:154-161` — rendered as `<Badge>` |
| `│   └── (links to settings)` | ❌ NOT FOUND | No link to project settings in the mode indicator |
| `├── FilterBar` | ✅ | `components/retainer-filter-bar.tsx` (374 lines), rendered at `retainer-view.tsx:164-170` |
| `│   ├── Date range selector (presets + custom)` | ✅ | `retainer-filter-bar.tsx:267-312` |
| `│   └── Category filter (multi-select)` | ✅ | `retainer-filter-bar.tsx:314-352` |
| `├── CycleDashboard (hero card)` | ✅ | `components/retainer-cycle-dashboard.tsx` (181 lines), rendered at `retainer-view.tsx:174-180` |
| `│   ├── Left: cycle range + fraction` | ✅ | `retainer-cycle-dashboard.tsx:67-78` |
| `│   ├── Right: remaining badge` | ✅ | `retainer-cycle-dashboard.tsx:81-86` |
| `│   └── Bottom: month-by-month mini-cards (rollover only)` | ✅ | `retainer-cycle-dashboard.tsx:89-103` |
| `├── MonthList (accordion, newest first)` | ✅ | `retainer-view.tsx:186-203` — months reversed (line 136), mapped to `RetainerMonthRow` |
| `│   └── MonthRow` | ✅ | `components/retainer-month-row.tsx` (354 lines) |
| `│       ├── Collapsed: date, cycle badge, Xh logged, status tag` | ✅ | `retainer-month-row.tsx:100-124` |
| `│       └── Expanded:` | ✅ | `retainer-month-row.tsx:127-214` |
| `│           ├── ThreeBoxSummary` | ✅ | `retainer-month-row.tsx:130-139` (usage), `222-292` (definition) |
| `│           ├── TaskList (grouped by category)` | ✅ | `retainer-month-row.tsx:142-188` |
| `│           │   ├── Category header + subtotal` | ✅ | `retainer-month-row.tsx:150-157` |
| `│           │   └── TaskRow: date, name, description, hours` | ✅ | `retainer-month-row.tsx:159-180` |
| `│           └── SettlementBlock` | ✅ | `retainer-month-row.tsx:192-212` |
| `│               ├── Extra hours: explanation + invoice` | ✅ | `retainer-month-row.tsx:296-353` (SettlementExtra component) |
| `│               └── Unused hours: info message` | ✅ | `retainer-month-row.tsx:206-211` |
| `└── Footer: config summary` | ✅ | `retainer-view.tsx:213-222` |

---

## §5 Layout & UX Decisions

### Filter bar

| Requirement | Status | Location |
|---|---|---|
| Sits between header and cycle dashboard | ✅ | `retainer-view.tsx:164-170` (after header, before dashboard) |
| Horizontal, compact, dropdown selects | ✅ | `retainer-filter-bar.tsx` uses `Select` + `Popover` |
| Date range presets: This cycle, Last cycle, Last 6 months, This year, All time | ✅ | `retainer-filter-bar.tsx:250-254` |
| Custom date range picker | ✅ | `retainer-filter-bar.tsx:289-312` — `Calendar mode="range"` |
| Default: "All time" | ✅ | Initial state is `{}` which maps to no filter = all time |
| Category multi-select | ✅ | `retainer-filter-bar.tsx:314-352` — checkbox list in popover |
| Category filter: tasks + hours used reflect filter, balances NOT affected | ✅ | `retainerView.ts:104-126` |
| Active filter count or clear button | ✅ | `retainer-filter-bar.tsx:354-370` — badge + X button |

### Collapsed month rows

| Requirement | Status | Location |
|---|---|---|
| Left: arrow chevron → date range → cycle badge → "Xh logged" | ✅ | `retainer-month-row.tsx:105-118` |
| Right: single status tag | ✅ | `retainer-month-row.tsx:121-123` |
| Mid-cycle positive: "+{n}h carries" (green) | ✅ | `retainerCompute.ts:331` — variant `"success"` |
| Mid-cycle negative: "–{n}h carries" (red/muted) | ✅ | `retainerCompute.ts:334` — variant `"destructive"` |
| Cycle-end extra: "+{n}h · payment due" (red/muted) | ✅ | `retainerCompute.ts:317` — variant `"destructive"` |
| Cycle-end unused: "{n}h unused" (amber/muted) | ✅ | `retainerCompute.ts:323` — variant `"warning"` |
| Cycle-end on budget: "on budget" (green) | ✅ | `retainerCompute.ts:327` — variant `"success"` |
| Rollover OFF positive: "{n}h unused" (amber) | ✅ | `retainerCompute.ts:348` — variant `"warning"` |
| Rollover OFF negative: "{n}h over" (red/muted) | ✅ | `retainerCompute.ts:342` — variant `"destructive"` |

### Three-box summary

| Requirement | Status | Location |
|---|---|---|
| Fixed labels: "Started with" / "Hours used" / "Ending balance" | ✅ | `retainer-month-row.tsx:252,266,280` |
| Never change labels based on state | ✅ | Labels are hardcoded via T constants |
| "Started with" = available hours + composition subtitle | ✅ | `retainer-month-row.tsx:249-261`, subtitle from `getStartedWithSubtitle()` |
| "Ending balance" shows +/– prefix | ✅ | `retainer-month-row.tsx:283` — sign logic at lines 82-85 |
| Color hints: positive=green, negative=red, zero=neutral | ✅ | `retainer-month-row.tsx:79-92` |

### Task list

| Requirement | Status | Location |
|---|---|---|
| Grouped by category | ✅ | `retainer-month-row.tsx:142-182` using `groupTasksByCategory()` |
| Category header: name + subtotal hours | ✅ | `retainer-month-row.tsx:150-157` |
| Table columns: date, task name, description, hours | ✅ | `retainer-month-row.tsx:159-180` |
| Total row at bottom with top border | ✅ | `retainer-month-row.tsx:184-187` |

### Settlement block

| Requirement | Status | Location |
|---|---|---|
| Only at cycle-end (rollover ON) or every month (rollover OFF) | ✅ | `retainer-month-row.tsx:192` — `month.settles && month.extraMinutes > 0` |
| Explanation text + invoice card with calculation | ✅ | `retainer-month-row.tsx:296-353` (SettlementExtra) |
| Unused hours info message | ✅ | `retainer-month-row.tsx:206-211` |

### Cycle dashboard

| Requirement | Status | Location |
|---|---|---|
| Shows current cycle only | ✅ | `retainer-view.tsx:77-89` — filters by `currentCycleIndex` |
| Left: "CURRENT CYCLE · {range}" + fraction | ✅ | `retainer-cycle-dashboard.tsx:67-78` |
| Right: remaining badge with color | ✅ | `retainer-cycle-dashboard.tsx:81-86` |
| Bottom (rollover ON): per-month mini-cards | ✅ | `retainer-cycle-dashboard.tsx:89-103` |
| Mini-cards: month name, hours logged, "of X / Yh available", status | ✅ | `retainer-cycle-dashboard.tsx:110-179` |

### Rollover mode indicator

| Requirement | Status | Location |
|---|---|---|
| Read-only display: "Rollover enabled" / "Monthly settlement" | ✅ | `retainer-view.tsx:154-161` — Badge component |
| Link to project settings | ❌ NOT FOUND | No link — badge is static text only |
| Confirmation dialog when changing rollover on existing project | ❌ NOT FOUND | No confirmation dialog in `project-form-dialog.tsx` |
| "Applies to all months" warning when changing budget/rate | ❌ NOT FOUND | No warning dialog |

---

## §6 Design Principles

| Requirement | Status | Notes |
|---|---|---|
| Notion/Linear muted colors | ✅ | Uses emerald/amber/red-50 tints, not bright |
| Tabular-nums for numbers | ⚠️ NOT VERIFIED | Not explicitly seen in component classes |
| Minimal borders | ✅ | Uses `border rounded-lg` pattern |
| Typography hierarchy: small labels → large numbers → context | ✅ | ThreeBoxSummary uses `text-xs` labels, large numbers, `text-xs` subtitles |
| No progress bars | ✅ | None found |
| Negative: – prefix, positive: + prefix on ending balances | ✅ | `retainer-month-row.tsx:82-85` |

---

## §7 Required Operations

| Requirement | Status | Location |
|---|---|---|
| Get retainer config for a project | ✅ | `convex/retainerView.ts:84-90` (inline in `getComputedView`) |
| Get all tasks for a project (optionally filtered) | ✅ | `convex/retainerView.ts:43-72` |
| Get computed months (server-side, with filters) | ✅ | `convex/retainerView.ts:93-126` |
| Create/update retainer config (at project creation + settings) | ✅ | `convex/projects.ts` — create/update mutations handle retainer fields |
| Add a task | ✅ | Existing `convex/tasks.ts` |
| Update/delete a task | ✅ | Existing `convex/tasks.ts` |
| Standalone compute function | ✅ | `convex/lib/retainerCompute.ts:174` |
| Standalone category grouping | ✅ | `convex/lib/retainerCompute.ts:266` |
| Standalone period formatting | ✅ | `convex/lib/retainerCompute.ts:136` |
| Compute runs server-side | ✅ | Called inside Convex query in `retainerView.ts` |

---

## §8 Integration with Project Creation Flow

| Requirement | Status | Location |
|---|---|---|
| Monthly hours budget input | ✅ | `project-form-dialog.tsx:619-632` — "Hours / Month" |
| Hourly rate input | ✅ | `project-form-dialog.tsx:633-645` — "Overage ({currency}/hr)" |
| Rollover enabled switch (default ON) | ✅ | `project-form-dialog.tsx:647-663` — defaults `true` (line 102) |
| Switch help text: rollover ON explanation | ✅ | `project-form-dialog.tsx:653` — "Hours roll over within 3-month cycles" |
| Switch help text: rollover OFF explanation | ✅ | `project-form-dialog.tsx:655` — "Each month settles independently" |
| Cycle start date picker (defaults 1st of current month) | ❌ NOT FOUND | No date picker for cycle start in the form |
| Currency select (default USD) | ⚠️ PARTIAL | Inherited from client, not a project-level field. Shown read-only. |
| All fields editable in project settings | ✅ | Edit mode pre-fills at `project-form-dialog.tsx:138-146` |
| Confirmation dialog when changing rollover on project with tasks | ❌ NOT FOUND | No confirmation dialog |
| "Applies to all months" warning when changing budget/rate | ❌ NOT FOUND | No warning |

---

## §9 File Organization

| Requirement | Status | Location |
|---|---|---|
| Compute logic — pure function, no framework deps | ✅ | `convex/lib/retainerCompute.ts` — pure TypeScript |
| Text dictionary — all strings in one place | ✅ | `lib/retainer-strings.ts` — single source of truth. `retainerCompute.ts` imports and uses T. |
| Utility functions — separate from UI | ✅ | `retainerCompute.ts` exports `groupTasksByCategory`, `formatPeriodLabel`, `minutesToHours`, etc. |
| Database layer — follows Convex patterns | ✅ | `convex/retainerView.ts` — standard Convex query pattern |
| UI components — follows existing organization | ✅ | Flat in `components/` folder: `retainer-view.tsx`, `retainer-cycle-dashboard.tsx`, `retainer-month-row.tsx`, `retainer-filter-bar.tsx` |

---

## Summary of Issues — Resolution Status

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | `getStatusTag` mid-cycle negative variant mismatch | ✅ FIXED | Test updated to expect `"destructive"` (correct behavior). `retainerCompute.test.ts:463` |
| 2 | `getEndingBalanceSubtitle` cycle-end zero balance mismatch | ✅ FIXED | Test updated to expect `"No extra charges"` (correct behavior). `retainerCompute.test.ts:594` |
| 3 | No cycle start date picker in project form | ✅ FIXED | Date picker added to `project-form-dialog.tsx`, defaults to 1st of current month. `startDate` arg added to `convex/projects.ts` create + update mutations. |
| 4 | No confirmation dialog when changing rollover | ✅ FIXED | `AlertDialog` added to `project-form-dialog.tsx` — "This will recompute all historical balances and settlement amounts. Continue?" |
| 5 | No "applies to all months" warning for budget/rate changes | ✅ FIXED | Warning text shown below budget/rate inputs when values differ from existing project. `project-form-dialog.tsx` |
| 6 | No settings link on mode indicator badge | ⏭️ SKIPPED | Per user request — leave as-is. |
| 7 | T dictionary duplication in retainerCompute.ts | ✅ FIXED | `retainerCompute.ts` now imports and uses `T` from `lib/retainer-strings.ts`. All 20+ hardcoded strings replaced. |
| 8 | `tagCycleClosed` unused in T dictionary | ✅ FIXED | Removed from `lib/retainer-strings.ts`. |
| 9 | Competing rollover models (retainerPeriods.ts) | ⏭️ SKIPPED | Per user request — leave as-is. |
| 10 | `extraCalc` hardcodes `$` | ✅ FIXED | `T.extraCalc` now takes a `currencySymbol` param. `getCurrencySymbol()` added to `lib/format.ts`. Used in `retainer-month-row.tsx`. |
| 11 | `includedHoursPerMonth` naming | ⏭️ SKIPPED | Per user request — leave as-is. |
| 12 | Hardcoded UI strings not in T dictionary | ✅ FIXED | Added to T: `hLogged`, `hAvailable`, `workCompleted`, `total`, `lastMonth`, `custom`, `pickDates`. All components updated. |
| 13 | Unused `retainerStatus` prop | ✅ FIXED | Removed from `project-detail-retainer.tsx` interface. Removed from usage in `projects/[id]/page.tsx`. |

### Tests

All 52 retainerCompute tests pass. All 12 format tests pass. (52 + 12 = 64 tests green)
