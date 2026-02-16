import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuth, isAdmin } from "./lib/permissions";
import {
  computeRetainerMonths,
  getCurrentYearMonth,
  getCycleInfo,
  type RetainerConfig,
  type TaskRecord,
} from "./lib/retainerCompute";

/**
 * Get the fully computed retainer view for a project.
 * Returns pre-computed months with balances, tasks, and settlement info.
 *
 * Category filter affects task lists and "hours used" subtotals only —
 * balances always use all tasks (per spec §2).
 */
export const getComputedView = query({
  args: {
    projectId: v.id("projects"),
    dateRangeStart: v.optional(v.string()), // YYYY-MM
    dateRangeEnd: v.optional(v.string()), // YYYY-MM
    categoryFilter: v.optional(v.array(v.string())), // workCategoryId[]
  },
  handler: async (ctx, { projectId, dateRangeStart, dateRangeEnd, categoryFilter }) => {
    const user = await requireAuth(ctx);
    const admin = isAdmin(user);

    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    if (project.billingType !== "retainer") {
      throw new Error("Not a retainer project");
    }

    const client = await ctx.db.get(project.clientId);

    // Fetch all work categories for name mapping
    const allCategories = await ctx.db.query("workCategories").collect();
    const categoryMap = new Map(allCategories.map((c) => [c._id, c.name]));

    // Fetch all tasks for this project
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .collect();

    // Fetch all time entries for all project tasks and build task records
    const taskRecords: TaskRecord[] = [];
    for (const task of allTasks) {
      if (task.isArchived) continue;

      const entries = await ctx.db
        .query("timeEntries")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .collect();

      for (const entry of entries) {
        taskRecords.push({
          taskId: task._id,
          title: task.title,
          description: task.clientUpdateText ?? undefined,
          date: entry.date,
          workCategoryId: task.workCategoryId,
          workCategoryName: task.workCategoryId
            ? categoryMap.get(task.workCategoryId) ?? "Unknown"
            : undefined,
          durationMinutes: entry.durationMinutes,
          note: entry.note,
        });
      }
    }

    // Group task records by YYYY-MM
    const tasksByMonth = new Map<string, TaskRecord[]>();
    for (const record of taskRecords) {
      const ym = record.date.substring(0, 7);
      const list = tasksByMonth.get(ym) ?? [];
      list.push(record);
      tasksByMonth.set(ym, list);
    }

    // Build retainer config
    const config: RetainerConfig = {
      includedMinutesPerMonth: project.includedHoursPerMonth ?? 0,
      overageRate: project.overageRate ?? 0,
      rolloverEnabled: project.rolloverEnabled ?? true,
      startDate: project.startDate ?? getCurrentYearMonth() + "-01",
      currency: client?.currency ?? "USD",
    };

    // Compute all months (always using full task data for correct balances)
    let months = computeRetainerMonths(config, tasksByMonth);

    // Apply date range filter to output (but computation was on full range for balance correctness)
    if (dateRangeStart) {
      months = months.filter((m) => m.yearMonth >= dateRangeStart);
    }
    if (dateRangeEnd) {
      months = months.filter((m) => m.yearMonth <= dateRangeEnd);
    }

    // Apply category filter to task lists and worked minutes (not balances)
    const categoryFilterSet = categoryFilter?.length
      ? new Set(categoryFilter)
      : null;

    const filteredMonths = months.map((month) => {
      if (!categoryFilterSet) return month;

      const filteredTasks = month.tasks.filter(
        (t) => t.workCategoryId && categoryFilterSet.has(t.workCategoryId),
      );
      const filteredWorkedMinutes = filteredTasks.reduce(
        (sum, t) => sum + t.durationMinutes,
        0,
      );

      return {
        ...month,
        // Replace tasks and worked with filtered versions
        tasks: filteredTasks,
        workedMinutes: filteredWorkedMinutes,
        // Keep balances unchanged — they always reflect all tasks
      };
    });

    // Determine current cycle index
    const currentYm = getCurrentYearMonth();
    const currentCycleInfo = getCycleInfo(currentYm, config.startDate);

    // Available category options for the filter bar
    const usedCategoryIds = new Set<string>();
    for (const record of taskRecords) {
      if (record.workCategoryId) usedCategoryIds.add(record.workCategoryId);
    }
    const categories = allCategories
      .filter((c) => usedCategoryIds.has(c._id) && !c.isArchived)
      .map((c) => ({ _id: c._id, name: c.name }));

    return {
      config: {
        includedMinutesPerMonth: config.includedMinutesPerMonth,
        rolloverEnabled: config.rolloverEnabled,
        startDate: config.startDate,
        currency: config.currency,
        ...(admin ? { overageRate: config.overageRate } : {}),
      },
      months: filteredMonths,
      currentCycleIndex: currentCycleInfo.cycleIndex,
      categories,
    };
  },
});

/**
 * Get filter options for the retainer view.
 * Returns available year-months (from time entries) and work categories.
 */
export const getFilterOptions = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    await requireAuth(ctx);

    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    if (project.billingType !== "retainer") {
      throw new Error("Not a retainer project");
    }

    // Collect all unique year-months from time entries
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .collect();

    const yearMonths = new Set<string>();
    const usedCategoryIds = new Set<string>();

    for (const task of tasks) {
      if (task.isArchived) continue;
      if (task.workCategoryId) usedCategoryIds.add(task.workCategoryId);

      const entries = await ctx.db
        .query("timeEntries")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .collect();

      for (const entry of entries) {
        yearMonths.add(entry.date.substring(0, 7));
      }
    }

    // Get category names
    const allCategories = await ctx.db.query("workCategories").collect();
    const categories = allCategories
      .filter((c) => usedCategoryIds.has(c._id) && !c.isArchived)
      .map((c) => ({ _id: c._id, name: c.name }));

    return {
      yearMonths: Array.from(yearMonths).sort(),
      categories,
      startDate: project.startDate,
      rolloverEnabled: project.rolloverEnabled ?? true,
    };
  },
});
