# Implementation Plan — Review Notes

Read these corrections before executing any chunk. These are gaps between
the implementation plan and the spec that must be addressed.

## 1. T Dictionary — exact strings are FINAL

The spec (§3) contains the complete T dictionary with every user-facing string.
These exact strings were refined through 10 iterations. The plan mentions
"Full T text dictionary from spec §3" but doesn't list the specific strings.

**Action:** Copy the EXACT T object from the spec. Don't paraphrase or
rename the keys. The strings are final:

Critical ones that are easy to get wrong:
- Row tags use +/– prefixes: `"+6h carries"`, `"–2h carries"` (not "6h saved" or "6h over")
- Ending balance always shows sign: `+9h` or `–2h` (never unsigned)
- `"Carries over"` (not "Available next month")
- `"Deducted next month"` (not "Taken from next month")
- `"from last month"` (not "carried over" or "owed")
- Cycle end tag: `"+6h · payment due"` (with + prefix and · separator)
- Dashboard label: `"Current cycle · Apr – Jun 2025"` (not just "Apr – Jun 2025")

## 2. Collapsed row layout — specific element order

The plan says "period label, cycle badge, Xh logged, status tag" — correct,
but the spec prototype has a specific layout:

**Left group (all inline):**
arrow chevron → period text → cycle badge (rollover only) → "Xh logged" (muted gray)

**Right side:**
single status tag

The "Xh logged" text sits LEFT, grouped with the date — not floating right.
This was a specific UX iteration. See prototype v10 for exact layout.

## 3. Cycle dashboard per-month cards — available shows fraction

The plan mentions "per-month mini-cards" but doesn't specify:
- Available line must show: `"of 9 / 10h available"` (fraction format, not just "of 9h available")
- The 9 gets colored (red if less than budget, green if more due to carryover)
- The 10 stays neutral as reference

## 4. Tag logic for cycle-end rows — NOT "cycle closed"

The plan's MonthRow (Chunk 3) doesn't specify the full tag logic for cycle-end months.
The spec says cycle-end rows should show what happened, not just "cycle closed":

- Cycle-end with extra hours: `"+6h · payment due"` (red tag)
- Cycle-end with unused hours: `"2h unused"` (amber tag)
- Cycle-end on budget: `"on budget"` (green tag)

"cycle closed" was explicitly removed during iteration. The tag should be informative.

## 5. Task list — table-like columns, not stacked

The plan mentions "task rows (date, name, description, hours)" but the spec
requires a specific 4-column table layout:

```
date (narrow) | task name (fixed ~200px) | description (flex fill) | hours (narrow, right-aligned)
```

All on ONE line, side by side — not date+name on first line with description below.
This was a specific design iteration (v10). See prototype for exact layout.

## 6. Task date = createdAt

The spec explicitly states: dates shown are when the task was CREATED (createdAt),
not when work was completed. The plan references "time entries" — make sure the
date field used is the creation date, not a completion/log date.

## 7. Settlement block — exact content

The plan mentions settlement blocks but doesn't detail:
- **Extra hours block** has two parts:
  1. Header with explanation: `"36h used this cycle — 6h more than the 30h included."`
  2. Invoice card below: `"Extra hours invoice"` title, `"6 hours × $80/h"` subtitle,
     `"$480"` amount on the right
- **Unused hours block**: single info message, muted amber background,
  `"2h not used this cycle. Balance resets for the next cycle."`
- Both use the T dictionary strings — don't hardcode text

## 8. Three-box "Ending balance" — +/– prefix is critical

The plan mentions three-box summary but doesn't call out:
- Ending balance number MUST show sign: `+6h` (green) or `–2h` (red) or `0h` (neutral)
- The + sign for positive balances was a specific design decision — don't omit it
- Background tint changes with state (positive=green-tint, negative=red-tint, zero=neutral)

## 9. Design aesthetic — Notion/Linear, muted colors

The plan says "Notion/Linear aesthetic" — good. But to be specific:
- No bright reds or greens. Use muted semantic variants (your theme's muted-destructive, etc.)
- Settlement blocks are calm/informational, not alarming
- Uppercase small labels with letter-spacing for section headers
- `font-variant-numeric: tabular-nums` on ALL numbers

## 10. Missing from plan: Rollover mode indicator in header

The spec (§5, "Rollover mode indicator") says the header should show:
- "Rollover enabled" or "Monthly settlement" — read-only text
- Optionally links to project settings

This isn't mentioned in any chunk. Add it to the RetainerView header area.
