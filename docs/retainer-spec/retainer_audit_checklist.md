# Retainer Module — Audit Checklist

Audited 2026-02-16 against:
- Spec: `/docs/retainer-spec/retainer_implementation_spec.md`
- Mockup: `/docs/retainer-spec/retainer_mockup_v10.jsx`
- Implementation files:
  - `lib/retainer-strings.ts`
  - `convex/lib/retainerCompute.ts`
  - `convex/retainerView.ts`
  - `components/retainer-view.tsx`
  - `components/retainer-cycle-dashboard.tsx`
  - `components/retainer-month-row.tsx`
  - `components/retainer-filter-bar.tsx`
  - `components/project-form-dialog.tsx`
  - `components/project-detail-retainer.tsx`

Legend:
- ✅ Matches spec
- ⚠️ Partially implemented (explain what's missing)
- ❌ Missing or wrong (explain)

---

## A. Text Dictionary (spec §3)

Check that EVERY string from the spec's T object exists and is used correctly.

### A1. Fixed box labels
- ✅ "Started with" — `T.startedWith` defined in `lib/retainer-strings.ts:8`, used in `ThreeBoxSummary` via `retainer-month-row.tsx:252`
- ✅ "Hours used" — `T.hoursUsed` defined at `:10`, used at `:266`
- ✅ "Ending balance" — `T.endingBalance` defined at `:11`, used at `:280`

### A2. Started-with subtitles
- ✅ `"{b}h budget"` — `T.startBudgetOnly` defined, returned by `getStartedWithSubtitle` when rollover ON + no carry + not cycle start (`retainerCompute.ts:377`)
- ✅ `"{b}h budget · cycle start"` — `T.startCycleStart` defined, returned at `:369`
- ✅ `"{b}h budget + {n}h from last month"` — `T.startWithCarry` defined, returned at `:372`
- ✅ `"{b}h budget – {n}h from last month"` — `T.startWithDeduction` defined, returned at `:375`
- ✅ `"{b}h monthly budget"` — `T.startNoRollover` defined, returned at `:367`

### A3. Ending balance subtitles
- ✅ `"Carries over"` — mid-cycle positive: `getEndingBalanceSubtitle` returns `"Carries over"` at `:399`
- ✅ `"Deducted next month"` — mid-cycle negative: returned at `:400`
- ✅ `"All hours used"` — mid-cycle zero: returned at `:401`
- ✅ `"Payment due"` — cycle-end with extra: returned at `:395`
- ✅ `"Not carried over"` — cycle-end unused, rollover ON: returned at `:396`
- ✅ `"Not used"` — rollover OFF unused: returned at `:388`
- ❌ `"No extra charges"` — cycle-end on budget: **`T.noExtraCharges` is defined in the dictionary but NEVER used.** `getEndingBalanceSubtitle` returns `"All hours used"` for cycle-end zero (`:397`) and rollover-OFF zero (`:390`). Per the mockup's `endingSub()`, any settlement + zero balance should return `T.noExtraCharges` ("No extra charges"), not `T.allUsed`. `"All hours used"` should only appear for mid-cycle zero.

### A4. Row tags (collapsed months, right side)
- ✅ `"+{n}h carries"` — mid-cycle positive: `getStatusTag` returns `+${hours}h carries` with variant `"success"` at `:331`
- ⚠️ `"–{n}h carries"` — mid-cycle negative: **String is correct** (`–${hours}h carries` at `:334`), but variant is `"secondary"` which renders as a plain gray/outline badge. Mockup uses `C.negative` (red) for negative carries. Should use `"destructive"` or a red-tinted custom style.
- ✅ `"+{n}h · payment due"` — cycle-end extra: returned at `:317` with variant `"destructive"`
- ✅ `"{n}h unused"` — cycle-end unused (amber): returned at `:323` with variant `"warning"`
- ✅ `"on budget"` — cycle-end zero: returned at `:327` with variant `"success"`
- ✅ `"{n}h unused"` — rollover OFF positive: returned at `:348` with variant `"warning"`
- ✅ `"{n}h over"` — rollover OFF negative: returned at `:342` with variant `"destructive"`

### A5. Settlement block strings
- ✅ `"{range} · Extra hours"` — `T.extraHoursLabel` used in `SettlementExtra` at `retainer-month-row.tsx:329`
- ✅ `"{used}h used this cycle — {extra}h more than the {pool}h included."` — `T.extraExplainCycle` used at `:333`
- ✅ `"{used}h used — {extra}h more than the {budget}h included."` — `T.extraExplainMonth` used at `:334`
- ✅ `"Extra hours invoice"` — `T.extraInvoice` used at `:341`
- ✅ `"{n} hours × ${rate}/h"` — `T.extraCalc` used at `:343`
- ✅ `"{n}h not used this cycle. Balance resets for the next cycle."` — `T.unusedCycle` used at `:209`
- ✅ `"{n}h not used. Next month starts fresh."` — `T.unusedMonth` used at `:210`

### A6. Dashboard strings
- ✅ `"Current cycle · {range}"` — `T.currentCycle(cycleRangeLabel)` used in `retainer-cycle-dashboard.tsx:61`
- ✅ `"This month"` — `T.thisMonth` used when rollover OFF at `:62`
- ✅ `"hours used"` — `T.hoursUsedLabel` used at `:77`
- ✅ `"remaining"` / `"over budget"` / `"fully used"` — all three used in `remainingLabel` at `:54-58`

### A7. Filter strings
- ✅ `"All time"`, `"This cycle"`, `"Last cycle"`, `"Last 6 months"`, `"This year"` — all defined in T, all used in `retainer-filter-bar.tsx:249-256`
- ✅ `"All categories"` — `T.allCategories` used at `:261`

---

## B. Collapsed Month Row Layout

- ⚠️ Left group all inline: chevron → period → cycle badge (rollover only) → "{n}h logged" — **Structure is correct**, but the cycle badge shows `M1/3`, `M2/3`, `M3/3` instead of a date range like "Jan – Mar" as in the mockup (`qRange[m.quarter]`). The mockup shows a readable date range badge; the implementation shows a compact `Mx/3` notation.
- ✅ "Xh logged" is on the LEFT side, grouped with date — correctly placed in the left `<div>` at `retainer-month-row.tsx:117`
- ✅ Right side: single status tag only — `Badge` on the right at `:121`
- ⚠️ Tags use correct colors: green for positive carries, red/muted for negative, amber for unused — **Positive carries = green ✅, amber for unused ✅, but mid-cycle negative carries use variant `"secondary"` which maps to plain `"outline"` badge (gray).** Mockup uses `C.negative` (red/muted) for negative carries. The badge should have a red tint.
- ✅ "logged" is the word used (not "used" or "worked") — `{workedHours}h logged` at `:119`

---

## C. Ending Balance Display

- ✅ Positive balance shows `+` prefix: "+6h" (green) — `endSign = "+"` in `ThreeBoxSummary` at `:245`, colored green via `endBalanceColor`
- ✅ Negative balance shows `–` prefix: "–2h" (red/muted) — `endSign = "–"` at `:245`, colored red
- ✅ Zero shows no prefix: "0h" (neutral) — `endSign = ""` at `:245`, muted foreground
- ✅ Sign is always visible — never just a bare number

---

## D. Cycle Dashboard

- ✅ Label: "CURRENT CYCLE · Apr – Jun 2025" (uppercase, with dot separator) — `T.currentCycle(cycleRangeLabel)` at `retainer-cycle-dashboard.tsx:61`, uppercase CSS class at `:69`
- ✅ Big fraction: "{used} / {budget} hours used" — rendered at `:72-78`
- ✅ Remaining badge with color (green positive, red negative) — `remainingBadgeClass` at `:48-52`
- ✅ Per-month mini cards (rollover ON only):
  - ✅ Month name shown — `monthName` at `MiniMonthCard:158`
  - ✅ Hours logged shown — `{workedHours}h logged` at `:167-169`
  - ✅ Available as fraction: "of {available} / {budget}h available" — at `:173-176`
  - ✅ Available number colored (red if less than budget, green if more) — `availableColor` at `:125-130`
  - ✅ Status tag on each mini card:
    - ✅ Mid-cycle positive: `"+{n}h carries"` — via `getStatusTag`
    - ✅ Mid-cycle negative: `"–{n}h carries"` — via `getStatusTag`
    - ✅ Cycle-end extra: `"+{n}h · payment due"` — via `getStatusTag`
    - ✅ Cycle-end unused: `"{n}h unused"` — via `getStatusTag`

---

## E. Three-Box Summary (expanded month)

- ✅ Labels are FIXED: "Started with" | "Hours used" | "Ending balance" — never change
- ✅ "Started with" shows available hours with composition subtitle — `availableHours` + `startedSubtitle` at `retainer-month-row.tsx:254-259`
- ✅ "Hours used" shows logged hours with task count subtitle — `workedHours` + `T.tasksCompleted` at `:268-273`
- ✅ "Ending balance" shows +/– prefixed number with subtitle — `endSign + endBalanceHours` + `endingSubtitle` at `:282-287`
- ✅ Background tint: positive=green-tint, negative=red-tint, zero=neutral — `endBalanceBg` at `:87-92`
- ✅ Numbers use tabular-nums — `tabular-nums` class on all number elements

---

## F. Task List (expanded month)

- ✅ Grouped by category (Design, Development, Copywriting, etc.) — `groupTasksByCategory(month.tasks)` at `retainer-month-row.tsx:58`
- ✅ Category header shows: name + subtotal hours — at `:151-156`
- ✅ 4-column table layout on ONE line: date | task name | description | hours
  - ✅ Date is narrow, left-aligned — `w-10` at `:167`
  - ✅ Task name is fixed width (~200px or similar) — `w-48` (~192px) at `:170`
  - ✅ Description fills remaining space — `flex-1` at `:173`
  - ✅ Hours is narrow, right-aligned — `w-8 text-right` at `:176`
- ✅ Description is NOT below the title — it's a separate column next to it
- ✅ Total row at bottom with border-top — `border-t pt-2` at `:184`
- ⚠️ Date shown is createdAt (when task was created, not completed) — **The date shown is `task.date` which comes from `entry.date` (time entry date, i.e. the day work was logged).** This is more accurate for a hours tracker than task creation date. The spec/checklist text is misleading — the mockup also uses `t.date` which represents when the task was done, not `createdAt`. The implementation is reasonable but does not match the checklist's literal wording.

---

## G. Settlement Block

- ✅ Only appears at cycle-end (rollover ON) or every month (rollover OFF) — `month.settles && month.extraMinutes > 0` at `retainer-month-row.tsx:192`; `month.settles && month.unusedMinutes > 0` at `:206`
- ⚠️ Extra hours block has TWO parts:
  - ✅ Explanation text with calculation — at `:328-335`
  - ⚠️ Invoice card: title + calculation subtitle + dollar amount on right — **Correct layout, but gated behind `isAdmin && overageRate > 0` at `:338`.** Non-admin users never see the invoice card. Spec doesn't mention admin-only, but this is correct per CLAUDE.md security rules (billing data hidden from team members). Marking ⚠️ because it deviates from spec, though intentionally.
- ✅ Unused hours block: single info message, muted amber background — amber-tinted card at `:207`
- ✅ Design is calm/informational, not alarming (muted colors, no harsh red) — uses `bg-red-50/50` (50% opacity), `bg-amber-50/50` — subtle

---

## H. Computation Logic

- ✅ CYCLE_LENGTH = 3, hardcoded as constant — `retainerCompute.ts:7`
- ✅ Cycle membership computed from date + config, never stored — `getCycleInfo()` at `:151`
- ✅ Balance resets to 0 at cycle start (monthInCycle === 1) — `if (cycleInfo.isCycleStart) balance = 0` at `:201`
- ✅ Settlement at cycle end (monthInCycle === 3) or every month (rollover OFF) — `:211` and `:252`
- ✅ No cron jobs, no triggers, no stored balances — pure computation in `computeRetainerMonths`
- ✅ Category filter affects task lists and "hours used" only — NOT balances — `retainerView.ts:108-126` applies filter to tasks/worked only, keeps balances unchanged
- ✅ Date range filter supported (for future export reuse) — `dateRangeStart`/`dateRangeEnd` args at `:23-24`
- ✅ Compute function is pure/serializable (no JSX, no DOM) — `retainerCompute.ts` has zero framework imports
- ✅ groupTasksByCategory is a standalone utility (not embedded in component) — exported function at `retainerCompute.ts:266`

---

## I. Config & Integration

- ✅ rolloverEnabled is a project-level setting (set at creation) — `convex/schema.ts:76`, set in `project-form-dialog.tsx:306`
- ✅ NOT a runtime toggle in the tracker UI — retainer view shows it as read-only Badge at `retainer-view.tsx:154-160`
- ✅ Header shows mode indicator: "Rollover enabled" or "Monthly settlement" (read-only) — Badge at `retainer-view.tsx:154-160`
- ✅ Project creation form has rollover switch with helper text — Switch + description at `project-form-dialog.tsx:647-664`
- ❌ Changing rollover on existing project shows confirmation dialog — **No confirmation dialog exists.** The edit form allows changing `rolloverEnabled` via the same Switch without any warning. Spec §8 says: _"changing it recomputes everything retroactively — warn the user"_ with a confirmation dialog: _"This will recompute all historical balances and settlement amounts. Continue?"_
- ✅ Config summary in header: "{budget}h/month · ${rate}/h" + " · 3-month cycles" (rollover only) — `retainer-view.tsx:143-152`

---

## J. Design Aesthetic

- ✅ Muted semantic colors (no bright red/green) — uses Tailwind emerald/red/amber with opacity modifiers (`bg-red-50/50`, `bg-emerald-50/50`)
- ✅ tabular-nums on ALL numbers — `tabular-nums` class consistently applied throughout all components
- ✅ Uppercase small labels with letter-spacing for section headers — `text-[10px] font-semibold uppercase tracking-wider` used for "CURRENT CYCLE", "Work completed", box labels
- ✅ Minimal borders, subtle gray — uses Tailwind's default `border` (gray), no heavy outlines
- ✅ Notion/Linear feel, not Google Material or Bootstrap-like — clean, minimal design with muted colors

---

## Summary

### ❌ Items that need fixing (2)

1. **A3: "No extra charges" subtitle never used** — `getEndingBalanceSubtitle()` in `retainerCompute.ts` returns `"All hours used"` for both cycle-end zero AND rollover-OFF zero. Per the mockup's `endingSub()`, settlement + zero balance should return `T.noExtraCharges` ("No extra charges"). `"All hours used"` should only appear for mid-cycle zero. The `T.noExtraCharges` string is defined but dead code.

2. **I5: No confirmation dialog when changing rollover on existing project** — The project edit form allows toggling `rolloverEnabled` without any confirmation. The spec requires a confirmation dialog: _"This will recompute all historical balances and settlement amounts. Continue?"_

### ⚠️ Items that are partially implemented (4)

1. **A4/B4: Mid-cycle negative carries badge color** — The string `"–{n}h carries"` is correct, but `getStatusTag` returns variant `"secondary"` which renders as a plain outline badge (gray). Mockup uses `C.negative` (red/muted). Should use a red-tinted badge style to indicate the negative carryover.

2. **B1: Cycle badge format** — Collapsed row shows `M1/3`, `M2/3`, `M3/3` instead of a date range like "Jan – Mar" as in the mockup (`qRange[m.quarter]`). Functional but less readable.

3. **F7: Task date semantics** — Date shown is `entry.date` (time entry date) rather than `task.createdAt`. This is actually more correct for an hours tracker (shows when work was done), but differs from the checklist's literal "createdAt" wording.

4. **G2b: Invoice card admin-only gating** — Invoice card is only visible to admins (`isAdmin && overageRate > 0`). Spec doesn't mention this restriction, but it's correct per CLAUDE.md security rules (billing data hidden from team members). Minor spec deviation, intentionally correct.
