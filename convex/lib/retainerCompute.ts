/**
 * Pure compute utilities for retainer hours tracking.
 * All values are in MINUTES (matching codebase convention).
 * No framework dependencies — reusable for server queries and future exports.
 */

import { T } from "../../lib/retainer-strings";

export const CYCLE_LENGTH = 3; // quarterly, not configurable

// ── Types ──────────────────────────────────────────────────────────

export interface RetainerConfig {
  /** Monthly budget in minutes */
  includedMinutesPerMonth: number;
  /** Overage rate (currency per hour) */
  overageRate: number;
  /** Whether hours roll over within 3-month cycles */
  rolloverEnabled: boolean;
  /** Cycle start date (YYYY-MM-DD), determines cycle alignment */
  startDate: string;
  /** Client currency code */
  currency: string;
}

export interface TaskRecord {
  taskId: string;
  title: string;
  description?: string; // plain text excerpt for display in task list
  date: string; // YYYY-MM-DD
  workCategoryId?: string;
  workCategoryName?: string;
  durationMinutes: number;
  note?: string;
}

export interface ComputedMonth {
  /** Display label, e.g. "Jan 1 – 31, 2025" */
  period: string;
  /** YYYY-MM key */
  yearMonth: string;
  /** 0-based cycle index */
  cycleIndex: number;
  /** 1-based position within cycle (1, 2, or 3) */
  monthInCycle: number;
  isCycleStart: boolean;
  isCycleEnd: boolean;
  /** All task records for this month */
  tasks: TaskRecord[];
  /** Sum of task durations in minutes */
  workedMinutes: number;
  /** Balance entering this month (minutes) */
  startBalance: number;
  /** startBalance + monthly budget (minutes) */
  availableMinutes: number;
  /** available - worked (minutes, can be negative) */
  endBalance: number;
  /** Only at settlement: abs(endBalance) if negative */
  extraMinutes: number;
  /** Only at settlement: endBalance if positive */
  unusedMinutes: number;
  /** Whether this month triggers settlement */
  settles: boolean;
}

export interface CycleInfo {
  monthInCycle: number;
  isCycleStart: boolean;
  isCycleEnd: boolean;
  cycleIndex: number;
}

export interface AggregatedTask {
  taskId: string;
  title: string;
  description?: string;
  workCategoryId?: string;
  workCategoryName?: string;
  totalMinutes: number;
  /** Earliest date from the underlying time entries (YYYY-MM-DD) */
  earliestDate: string;
}

export interface CategoryGroup {
  workCategoryId: string | undefined;
  categoryName: string;
  tasks: AggregatedTask[];
  totalMinutes: number;
}

export interface StatusTag {
  label: string;
  variant: "default" | "success" | "destructive" | "warning" | "secondary";
}

// ── Date helpers ───────────────────────────────────────────────────

/**
 * Get the first and last day of a month from a YYYY-MM string.
 */
export function getMonthRange(yearMonth: string): { start: string; end: string } {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/**
 * Get all YYYY-MM strings between two months (inclusive).
 */
export function getAllMonthsBetween(first: string, last: string): string[] {
  const [fy, fm] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  const result: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ly || (y === ly && m <= lm)) {
    result.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return result;
}

/**
 * Get the current YYYY-MM string.
 */
export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Convert minutes to hours, rounded to 1 decimal.
 * e.g. 90 → 1.5, 600 → 10, 0 → 0
 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

/**
 * Format a period label from a YYYY-MM string.
 * e.g. "2025-01" → "Jan 1 – 31, 2025"
 */
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatPeriodLabel(yearMonth: string): string {
  const { end } = getMonthRange(yearMonth);
  const [, , lastDay] = end.split("-").map(Number);
  const [year, month] = yearMonth.split("-").map(Number);
  const monthName = MONTH_SHORT[month - 1];
  return `${monthName} 1 – ${lastDay}, ${year}`;
}

// ── Cycle assignment ───────────────────────────────────────────────

/**
 * Determine which cycle a month belongs to, relative to the project start date.
 */
export function getCycleInfo(yearMonth: string, cycleStartDate: string): CycleInfo {
  const [y, m] = yearMonth.split("-").map(Number);
  const [sy, sm] = cycleStartDate.split("-").map(Number);
  const monthsSinceStart = (y - sy) * 12 + (m - sm);

  // Pre-start month: return neutral values
  if (monthsSinceStart < 0) {
    return { monthInCycle: 0, isCycleStart: false, isCycleEnd: false, cycleIndex: -1 };
  }

  const monthInCycle = (monthsSinceStart % CYCLE_LENGTH) + 1;
  const cycleIndex = Math.floor(monthsSinceStart / CYCLE_LENGTH);
  return {
    monthInCycle,
    isCycleStart: monthInCycle === 1,
    isCycleEnd: monthInCycle === CYCLE_LENGTH,
    cycleIndex,
  };
}

// ── Core balance computation ───────────────────────────────────────

/**
 * Compute retainer months from config and task records grouped by month.
 *
 * @param config - Retainer project configuration
 * @param tasksByMonth - Map of YYYY-MM → TaskRecord[]
 * @returns ComputedMonth[] sorted chronologically (oldest first)
 */
export function computeRetainerMonths(
  config: RetainerConfig,
  tasksByMonth: Map<string, TaskRecord[]>,
  currentYmOverride?: string,
): ComputedMonth[] {
  // Determine month range: from startDate month to current month
  const startYm = config.startDate.substring(0, 7);
  const currentYm = currentYmOverride ?? getCurrentYearMonth();

  // Also include any months from tasksByMonth that might be outside the range
  let firstMonth = startYm;
  let lastMonth = currentYm;
  for (const ym of tasksByMonth.keys()) {
    if (ym > lastMonth) lastMonth = ym;
  }

  const allMonths = getAllMonthsBetween(firstMonth, lastMonth);
  const results: ComputedMonth[] = [];
  let balance = 0;

  for (const ym of allMonths) {
    const cycleInfo = getCycleInfo(ym, config.startDate);
    const tasks = tasksByMonth.get(ym) ?? [];
    const workedMinutes = tasks.reduce((sum, t) => sum + t.durationMinutes, 0);

    if (config.rolloverEnabled) {
      // Cycle start → balance resets to 0
      if (cycleInfo.isCycleStart) balance = 0;

      const startBalance = balance;
      const availableMinutes = startBalance + config.includedMinutesPerMonth;
      balance = availableMinutes - workedMinutes;

      let extraMinutes = 0;
      let unusedMinutes = 0;
      let settles = false;

      if (cycleInfo.isCycleEnd) {
        extraMinutes = balance < 0 ? Math.abs(balance) : 0;
        unusedMinutes = balance > 0 ? balance : 0;
        settles = true;
      }

      results.push({
        period: formatPeriodLabel(ym),
        yearMonth: ym,
        cycleIndex: cycleInfo.cycleIndex,
        monthInCycle: cycleInfo.monthInCycle,
        isCycleStart: cycleInfo.isCycleStart,
        isCycleEnd: cycleInfo.isCycleEnd,
        tasks,
        workedMinutes,
        startBalance,
        availableMinutes,
        endBalance: balance,
        extraMinutes,
        unusedMinutes,
        settles,
      });
    } else {
      // No rollover: each month is independent
      const availableMinutes = config.includedMinutesPerMonth;
      const endBalance = availableMinutes - workedMinutes;

      results.push({
        period: formatPeriodLabel(ym),
        yearMonth: ym,
        cycleIndex: cycleInfo.cycleIndex,
        monthInCycle: cycleInfo.monthInCycle,
        isCycleStart: cycleInfo.isCycleStart,
        isCycleEnd: cycleInfo.isCycleEnd,
        tasks,
        workedMinutes,
        startBalance: 0,
        availableMinutes,
        endBalance,
        extraMinutes: endBalance < 0 ? Math.abs(endBalance) : 0,
        unusedMinutes: endBalance > 0 ? endBalance : 0,
        settles: true,
      });
    }
  }

  return results;
}

// ── Category grouping ──────────────────────────────────────────────

/**
 * Aggregate time-entry-level TaskRecords into one AggregatedTask per unique task,
 * summing durations.
 */
function aggregateTasks(records: TaskRecord[]): AggregatedTask[] {
  const map = new Map<string, AggregatedTask>();
  for (const r of records) {
    const existing = map.get(r.taskId);
    if (existing) {
      existing.totalMinutes += r.durationMinutes;
      if (r.date < existing.earliestDate) {
        existing.earliestDate = r.date;
      }
    } else {
      map.set(r.taskId, {
        taskId: r.taskId,
        title: r.title,
        description: r.description,
        workCategoryId: r.workCategoryId,
        workCategoryName: r.workCategoryName,
        totalMinutes: r.durationMinutes,
        earliestDate: r.date,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.earliestDate.localeCompare(b.earliestDate));
}

/**
 * Group task records by work category, aggregating per unique task.
 * Returns groups sorted by category name, with "Uncategorized" last.
 */
export function groupTasksByCategory(
  tasks: TaskRecord[],
  categoryMap?: Map<string, string>,
): CategoryGroup[] {
  const groups = new Map<string | undefined, TaskRecord[]>();

  for (const task of tasks) {
    const key = task.workCategoryId;
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }

  const result: CategoryGroup[] = [];
  for (const [catId, catTasks] of groups) {
    const name =
      catTasks[0]?.workCategoryName ??
      (catId && categoryMap?.get(catId)) ??
      "Uncategorized";
    result.push({
      workCategoryId: catId,
      categoryName: name,
      tasks: aggregateTasks(catTasks),
      totalMinutes: catTasks.reduce((sum, t) => sum + t.durationMinutes, 0),
    });
  }

  // Sort: named categories alphabetically, Uncategorized last
  return result.sort((a, b) => {
    if (a.categoryName === "Uncategorized") return 1;
    if (b.categoryName === "Uncategorized") return -1;
    return a.categoryName.localeCompare(b.categoryName);
  });
}

// ── Status tag logic ───────────────────────────────────────────────

/**
 * Determine the status tag for a collapsed month row.
 */
export function getStatusTag(
  month: ComputedMonth,
  rolloverEnabled: boolean,
): StatusTag {
  const hours = minutesToHours(Math.abs(month.endBalance));

  if (rolloverEnabled) {
    if (month.isCycleEnd) {
      // Cycle end settlement
      if (month.extraMinutes > 0) {
        return {
          label: T.tagPaymentDue(minutesToHours(month.extraMinutes)),
          variant: "destructive",
        };
      }
      if (month.unusedMinutes > 0) {
        return {
          label: T.tagUnused(minutesToHours(month.unusedMinutes)),
          variant: "warning",
        };
      }
      return { label: T.tagOnBudget, variant: "success" };
    }
    // Mid-cycle
    if (month.endBalance > 0) {
      return { label: `+${T.tagCarries(hours)}`, variant: "success" };
    }
    if (month.endBalance < 0) {
      return { label: `–${T.tagCarries(hours)}`, variant: "destructive" };
    }
    return { label: T.tagOnBudget, variant: "success" };
  }

  // No rollover: every month settles
  if (month.endBalance < 0) {
    return {
      label: T.tagOver(minutesToHours(month.extraMinutes)),
      variant: "destructive",
    };
  }
  if (month.endBalance > 0) {
    return {
      label: T.tagUnused(minutesToHours(month.unusedMinutes)),
      variant: "warning",
    };
  }
  return { label: T.tagOnBudget, variant: "success" };
}

// ── Subtitle helpers ───────────────────────────────────────────────

/**
 * Get the "Started with" box subtitle explaining the number's composition.
 */
export function getStartedWithSubtitle(
  month: ComputedMonth,
  budgetHours: number,
  rolloverEnabled: boolean,
): string {
  if (!rolloverEnabled) {
    return T.startNoRollover(budgetHours);
  }
  if (month.isCycleStart) {
    return T.startCycleStart(budgetHours);
  }
  if (month.startBalance > 0) {
    return T.startWithCarry(budgetHours, minutesToHours(month.startBalance));
  }
  if (month.startBalance < 0) {
    return T.startWithDeduction(budgetHours, minutesToHours(Math.abs(month.startBalance)));
  }
  return T.startBudgetOnly(budgetHours);
}

/**
 * Get the "Ending balance" box subtitle.
 */
export function getEndingBalanceSubtitle(
  month: ComputedMonth,
  rolloverEnabled: boolean,
): string {
  if (!rolloverEnabled) {
    if (month.endBalance > 0) return T.notUsed;
    if (month.endBalance < 0) return T.paymentDue;
    return T.noExtraCharges;
  }
  // Rollover enabled
  if (month.isCycleEnd) {
    if (month.endBalance > 0) return T.notCarriedOver;
    if (month.endBalance < 0) return T.paymentDue;
    return T.noExtraCharges;
  }
  // Mid-cycle
  if (month.endBalance > 0) return T.carriesOver;
  if (month.endBalance < 0) return T.deductedNext;
  return T.allUsed;
}
