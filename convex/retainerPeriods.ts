import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { requireAuth } from "./lib/permissions";
import { Id, Doc } from "./_generated/dataModel";

const ROLLOVER_MONTHS = 3; // hardcoded for v1 (constraint #23)

/**
 * Get the first and last day of a month given a YYYY-MM string.
 */
function getMonthRange(yearMonth: string): {
  start: string;
  end: string;
} {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  // Last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/**
 * Get the YYYY-MM string for N months before a given YYYY-MM.
 */
function subtractMonths(yearMonth: string, n: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1 - n, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Get or create a retainer period for a given month (lazy creation, constraint #25).
 * Computes rollover from previous months' unused hours.
 */
export const getOrCreateForMonth = mutation({
  args: {
    projectId: v.id("projects"),
    yearMonth: v.string(), // YYYY-MM
  },
  handler: async (ctx, { projectId, yearMonth }) => {
    await requireAuth(ctx);

    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    if (project.billingType !== "retainer") {
      throw new Error("Not a retainer project");
    }

    const { start, end } = getMonthRange(yearMonth);

    // Check if period already exists
    const existing = await ctx.db
      .query("retainerPeriods")
      .withIndex("by_projectId_periodStart", (q) =>
        q.eq("projectId", projectId).eq("periodStart", start),
      )
      .unique();

    if (existing) return existing._id;

    // Compute rollover from previous ROLLOVER_MONTHS months
    const rolloverMinutes = await computeRolloverMinutes(
      ctx,
      projectId,
      yearMonth,
    );

    return await ctx.db.insert("retainerPeriods", {
      projectId,
      periodStart: start,
      periodEnd: end,
      includedMinutes: project.includedHoursPerMonth ?? 0,
      rolloverMinutes,
    });
  },
});

/**
 * Compute rollover minutes from previous months.
 * Rollover = sum of unused hours from the last ROLLOVER_MONTHS months.
 * Only the unused portion of the period's OWN included minutes rolls over
 * (rollover hours don't roll over again — they expire).
 */
async function computeRolloverMinutes(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  currentYearMonth: string,
): Promise<number> {
  let totalRollover = 0;

  for (let i = 1; i <= ROLLOVER_MONTHS; i++) {
    const prevMonth = subtractMonths(currentYearMonth, i);
    const { start: prevStart } = getMonthRange(prevMonth);

    const prevPeriod = await ctx.db
      .query("retainerPeriods")
      .withIndex("by_projectId_periodStart", (q) =>
        q.eq("projectId", projectId).eq("periodStart", prevStart),
      )
      .unique();

    if (!prevPeriod) continue;

    // Get used minutes for this period (always computed from time entries)
    const usedMinutes = await computeUsedMinutesForPeriod(
      ctx,
      projectId,
      prevMonth,
    );

    // Only the unused portion of the period's OWN included minutes rolls over
    const ownUnused = Math.max(
      0,
      prevPeriod.includedMinutes - usedMinutes,
    );

    totalRollover += ownUnused;
  }

  return totalRollover;
}

/**
 * Compute used minutes for a retainer in a given month.
 * Always computed from time entries (constraint #24 — never cached).
 */
async function computeUsedMinutesForPeriod(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  yearMonth: string,
): Promise<number> {
  const { start, end } = getMonthRange(yearMonth);
  // Next day after end for < comparison
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const nextDay = new Date(endYear, endMonth - 1, endDay + 1);
  const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;

  // Get all tasks for this project
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .collect();

  let totalMinutes = 0;
  for (const task of tasks) {
    const entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
      .collect();

    totalMinutes += entries
      .filter((e: Doc<"timeEntries">) => e.date >= start && e.date < nextDayStr)
      .reduce((sum: number, e: Doc<"timeEntries">) => sum + e.durationMinutes, 0);
  }

  return totalMinutes;
}

/**
 * Query: Get retainer usage data for a specific month.
 * Returns included, rollover, used (computed), overage, and warnings.
 */
export const getUsage = query({
  args: {
    projectId: v.id("projects"),
    yearMonth: v.string(), // YYYY-MM
  },
  handler: async (ctx, { projectId, yearMonth }) => {
    await requireAuth(ctx);

    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    if (project.billingType !== "retainer") {
      throw new Error("Not a retainer project");
    }

    const { start } = getMonthRange(yearMonth);

    // Look up existing period
    const period = await ctx.db
      .query("retainerPeriods")
      .withIndex("by_projectId_periodStart", (q) =>
        q.eq("projectId", projectId).eq("periodStart", start),
      )
      .unique();

    const includedMinutes = period?.includedMinutes ?? project.includedHoursPerMonth ?? 0;
    const rolloverMinutes = period?.rolloverMinutes ?? 0;

    // Always compute used from time entries (constraint #24)
    const usedMinutes = await computeUsedMinutesForPeriod(
      ctx,
      projectId,
      yearMonth,
    );

    const totalAvailable = includedMinutes + rolloverMinutes;
    const overageMinutes = Math.max(0, usedMinutes - totalAvailable);
    const usagePercent =
      totalAvailable > 0 ? Math.round((usedMinutes / totalAvailable) * 100) : 0;

    // Compute expiring rollover hours
    const expiringMonth = subtractMonths(yearMonth, ROLLOVER_MONTHS);
    const { start: expiringStart } = getMonthRange(expiringMonth);
    const expiringPeriod = await ctx.db
      .query("retainerPeriods")
      .withIndex("by_projectId_periodStart", (q) =>
        q.eq("projectId", projectId).eq("periodStart", expiringStart),
      )
      .unique();

    let expiringMinutes = 0;
    if (expiringPeriod) {
      const expiringUsed = await computeUsedMinutesForPeriod(
        ctx,
        projectId,
        expiringMonth,
      );
      expiringMinutes = Math.max(
        0,
        expiringPeriod.includedMinutes - expiringUsed,
      );
    }

    return {
      periodExists: !!period,
      includedMinutes,
      rolloverMinutes,
      usedMinutes,
      totalAvailable,
      overageMinutes,
      usagePercent,
      expiringMinutes,
      warnings: {
        usage80: usagePercent >= 80 && overageMinutes === 0,
        overage: overageMinutes > 0,
        expiring: expiringMinutes > 0,
      },
      overageRate: project.overageRate ?? 0,
    };
  },
});

/**
 * Query: Get month-by-month history for a retainer.
 */
export const getHistory = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireAuth(ctx);

    const periods = await ctx.db
      .query("retainerPeriods")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .collect();

    // Sort by period start descending (most recent first)
    periods.sort((a, b) => b.periodStart.localeCompare(a.periodStart));

    return await Promise.all(
      periods.map(async (period) => {
        const yearMonth = period.periodStart.substring(0, 7);
        const usedMinutes = await computeUsedMinutesForPeriod(
          ctx,
          projectId,
          yearMonth,
        );

        const totalAvailable = period.includedMinutes + period.rolloverMinutes;
        const overageMinutes = Math.max(0, usedMinutes - totalAvailable);

        return {
          _id: period._id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          yearMonth,
          includedMinutes: period.includedMinutes,
          rolloverMinutes: period.rolloverMinutes,
          usedMinutes,
          overageMinutes,
        };
      }),
    );
  },
});
