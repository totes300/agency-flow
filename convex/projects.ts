import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireAuth, isAdmin } from "./lib/permissions";
import { stopUserTimer } from "./lib/timerHelpers";
import { billingType, retainerStatus } from "./schema";

/**
 * Validate that a string is a valid YYYY-MM-DD date.
 */
function validateDateString(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: "${date}". Expected YYYY-MM-DD.`);
  }
  const [y, m, d] = date.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    throw new Error(`Invalid date: "${date}". Day does not exist.`);
  }
}

/**
 * List projects for a client. Admin sees all, member sees all (project names are not sensitive).
 */
export const listByClient = query({
  args: {
    clientId: v.id("clients"),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, { clientId, includeArchived }) => {
    await requireAdmin(ctx);

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_clientId", (q) => q.eq("clientId", clientId))
      .collect();

    return includeArchived
      ? projects
      : projects.filter((p) => !p.isArchived);
  },
});

/**
 * List all active projects (for project pickers). Both admin and members.
 */
export const listAll = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, { includeArchived }) => {
    const user = await requireAuth(ctx);
    const admin = isAdmin(user);

    const allProjects = await ctx.db.query("projects").collect();
    const projects = includeArchived
      ? allProjects
      : allProjects.filter((p) => !p.isArchived);

    // Enrich with client name and currency
    return await Promise.all(
      projects.map(async (project) => {
        const client = await ctx.db.get(project.clientId);
        return {
          _id: project._id,
          _creationTime: project._creationTime,
          clientId: project.clientId,
          name: project.name,
          billingType: project.billingType,
          isArchived: project.isArchived,
          retainerStatus: project.retainerStatus,
          startDate: project.startDate,
          lastInvoicedAt: project.lastInvoicedAt,
          defaultAssignees: project.defaultAssignees,
          clientName: client?.name ?? "Unknown",
          clientCurrency: client?.currency ?? "USD",
          // Billing-sensitive fields — admin only
          ...(admin ? {
            hourlyRate: project.hourlyRate,
            overageRate: project.overageRate,
            tmCategoryRates: project.tmCategoryRates,
            includedHoursPerMonth: project.includedHoursPerMonth,
          } : {}),
        };
      }),
    );
  },
});

/**
 * Get a single project with enriched data.
 */
export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    const user = await requireAuth(ctx);
    const project = await ctx.db.get(id);
    if (!project) return null;

    const client = await ctx.db.get(project.clientId);

    // Fetch all tasks for the project once
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_projectId", (q) => q.eq("projectId", id))
      .collect();

    // Fetch time entries for all tasks in one pass
    const minutesByTask = new Map<string, number>();
    let totalMinutes = 0;
    for (const task of allTasks) {
      const entries = await ctx.db
        .query("timeEntries")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .collect();
      const taskMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
      minutesByTask.set(task._id, taskMinutes);
      if (!task.isArchived) {
        totalMinutes += taskMinutes;
      }
    }

    // For Fixed projects, load category estimates
    let categoryEstimates: Array<{
      _id: string;
      workCategoryId: string;
      workCategoryName: string;
      estimatedMinutes: number;
      internalCostRate?: number;
      clientBillingRate?: number;
      actualMinutes: number;
    }> = [];

    if (project.billingType === "fixed") {
      const estimates = await ctx.db
        .query("projectCategoryEstimates")
        .withIndex("by_projectId", (q) => q.eq("projectId", id))
        .collect();

      // Group tasks by work category for efficient lookup
      const tasksByCategory = new Map<string, typeof allTasks>();
      for (const task of allTasks) {
        if (task.workCategoryId && !task.isArchived) {
          const existing = tasksByCategory.get(task.workCategoryId) ?? [];
          existing.push(task);
          tasksByCategory.set(task.workCategoryId, existing);
        }
      }

      categoryEstimates = await Promise.all(
        estimates.map(async (est) => {
          const category = await ctx.db.get(est.workCategoryId);

          // Sum actual minutes from pre-fetched data
          const categoryTasks = tasksByCategory.get(est.workCategoryId) ?? [];
          const actualMinutes = categoryTasks.reduce(
            (sum, t) => sum + (minutesByTask.get(t._id) ?? 0),
            0,
          );

          return {
            _id: est._id,
            workCategoryId: est.workCategoryId,
            workCategoryName: category?.name ?? "Unknown",
            estimatedMinutes: est.estimatedMinutes,
            ...(isAdmin(user) ? {
              internalCostRate: est.internalCostRate,
              clientBillingRate: est.clientBillingRate,
            } : {}),
            actualMinutes,
          };
        }),
      );
    }

    // Enrich T&M category rates with names
    let enrichedTmCategoryRates: Array<{
      workCategoryId: string;
      workCategoryName: string;
      rate: number;
    }> | undefined;

    if (project.tmCategoryRates && project.tmCategoryRates.length > 0) {
      enrichedTmCategoryRates = await Promise.all(
        project.tmCategoryRates.map(async (r) => {
          const category = await ctx.db.get(r.workCategoryId);
          return {
            workCategoryId: r.workCategoryId,
            workCategoryName: category?.name ?? "Unknown",
            rate: r.rate,
          };
        }),
      );
    }

    // Compute effective assignees (global defaults merged with project overrides)
    const activeCategories = (await ctx.db.query("workCategories").collect()).filter(
      (c) => !c.isArchived,
    );
    const overrideMap = new Map(
      (project.defaultAssignees ?? []).map((a) => [a.workCategoryId, a.userId]),
    );
    const effectiveAssignees = await Promise.all(
      activeCategories.map(async (cat) => {
        const overrideUserId = overrideMap.get(cat._id);
        const isOverride = overrideUserId !== undefined;
        const userId = overrideUserId ?? cat.defaultUserId ?? undefined;
        const userName = userId ? (await ctx.db.get(userId))?.name ?? null : null;
        return {
          workCategoryId: cat._id,
          workCategoryName: cat.name,
          userId: userId ?? null,
          userName,
          isOverride,
        };
      }),
    );

    const admin = isAdmin(user);

    return {
      _id: project._id,
      _creationTime: project._creationTime,
      clientId: project.clientId,
      name: project.name,
      billingType: project.billingType,
      isArchived: project.isArchived,
      retainerStatus: project.retainerStatus,
      startDate: project.startDate,
      rolloverEnabled: project.rolloverEnabled,
      lastInvoicedAt: project.lastInvoicedAt,
      defaultAssignees: project.defaultAssignees,
      clientName: client?.name ?? "Unknown",
      clientCurrency: client?.currency ?? "USD",
      categoryEstimates: admin ? categoryEstimates : [],
      totalMinutes,
      effectiveAssignees,
      // Billing-sensitive fields — admin only
      ...(admin ? {
        hourlyRate: project.hourlyRate,
        overageRate: project.overageRate,
        tmCategoryRates: enrichedTmCategoryRates ?? project.tmCategoryRates,
        includedHoursPerMonth: project.includedHoursPerMonth,
      } : {}),
    };
  },
});

/**
 * Create a project. Admin only.
 */
export const create = mutation({
  args: {
    clientId: v.id("clients"),
    name: v.string(),
    billingType,
    // Retainer-specific
    includedHoursPerMonth: v.optional(v.number()), // in minutes
    overageRate: v.optional(v.number()),
    rolloverEnabled: v.optional(v.boolean()),
    startDate: v.optional(v.string()), // YYYY-MM-DD, cycle start date
    // T&M-specific
    hourlyRate: v.optional(v.number()),
    tmCategoryRates: v.optional(
      v.array(v.object({ workCategoryId: v.id("workCategories"), rate: v.number() })),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Client not found");

    const trimmedName = args.name.trim();
    if (!trimmedName) throw new Error("Project name cannot be empty");

    if (args.billingType === "retainer") {
      if (!args.includedHoursPerMonth || args.includedHoursPerMonth <= 0) {
        throw new Error("Retainer projects require included hours per month");
      }
      if (args.startDate) {
        validateDateString(args.startDate);
      }
      const now = new Date();
      const defaultStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      return await ctx.db.insert("projects", {
        clientId: args.clientId,
        name: trimmedName,
        billingType: "retainer",
        isArchived: false,
        retainerStatus: "active",
        includedHoursPerMonth: args.includedHoursPerMonth,
        overageRate: args.overageRate,
        rolloverEnabled: args.rolloverEnabled ?? true,
        startDate: args.startDate ?? defaultStartDate,
      });
    }

    if (args.billingType === "t_and_m") {
      return await ctx.db.insert("projects", {
        clientId: args.clientId,
        name: trimmedName,
        billingType: "t_and_m",
        isArchived: false,
        hourlyRate: args.hourlyRate,
        tmCategoryRates: args.tmCategoryRates,
      });
    }

    return await ctx.db.insert("projects", {
      clientId: args.clientId,
      name: trimmedName,
      billingType: "fixed",
      isArchived: false,
    });
  },
});

/**
 * Update project details. Admin only.
 */
export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    // Retainer-specific
    includedHoursPerMonth: v.optional(v.number()),
    overageRate: v.optional(v.number()),
    rolloverEnabled: v.optional(v.boolean()),
    startDate: v.optional(v.string()),
    // T&M-specific
    hourlyRate: v.optional(v.number()),
    tmCategoryRates: v.optional(
      v.array(v.object({ workCategoryId: v.id("workCategories"), rate: v.number() })),
    ),
  },
  handler: async (ctx, { id, ...updates }) => {
    await requireAdmin(ctx);
    const project = await ctx.db.get(id);
    if (!project) throw new Error("Project not found");

    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) throw new Error("Project name cannot be empty");
      patch.name = trimmed;
    }

    // Retainer-specific fields
    if (project.billingType === "retainer") {
      if (updates.includedHoursPerMonth !== undefined)
        patch.includedHoursPerMonth = updates.includedHoursPerMonth;
      if (updates.overageRate !== undefined)
        patch.overageRate = updates.overageRate;
      if (updates.rolloverEnabled !== undefined)
        patch.rolloverEnabled = updates.rolloverEnabled;
      if (updates.startDate !== undefined) {
        validateDateString(updates.startDate);
        patch.startDate = updates.startDate;
      }
    }

    // T&M-specific fields
    if (project.billingType === "t_and_m") {
      if (updates.hourlyRate !== undefined) patch.hourlyRate = updates.hourlyRate;
      if (updates.tmCategoryRates !== undefined)
        patch.tmCategoryRates = updates.tmCategoryRates;
    }

    await ctx.db.patch(id, patch);
  },
});

/**
 * Set category estimates for a Fixed project. Admin only.
 * Replaces all existing estimates with the provided ones.
 */
export const setCategoryEstimates = mutation({
  args: {
    projectId: v.id("projects"),
    estimates: v.array(
      v.object({
        workCategoryId: v.id("workCategories"),
        estimatedMinutes: v.number(),
        internalCostRate: v.optional(v.number()),
        clientBillingRate: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { projectId, estimates }) => {
    await requireAdmin(ctx);
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    if (project.billingType !== "fixed") {
      throw new Error("Category estimates are only for Fixed projects");
    }

    // Delete existing estimates
    const existing = await ctx.db
      .query("projectCategoryEstimates")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .collect();
    for (const est of existing) {
      await ctx.db.delete(est._id);
    }

    // Insert new estimates
    for (const est of estimates) {
      await ctx.db.insert("projectCategoryEstimates", {
        projectId,
        workCategoryId: est.workCategoryId,
        estimatedMinutes: est.estimatedMinutes,
        internalCostRate: est.internalCostRate,
        clientBillingRate: est.clientBillingRate,
      });
    }
  },
});

/**
 * Set default assignees for a project. Admin only.
 * Maps work categories to default users for auto-suggest (Phase 3).
 */
export const setDefaultAssignees = mutation({
  args: {
    projectId: v.id("projects"),
    defaultAssignees: v.array(
      v.object({
        workCategoryId: v.id("workCategories"),
        userId: v.id("users"),
      }),
    ),
  },
  handler: async (ctx, { projectId, defaultAssignees }) => {
    await requireAdmin(ctx);
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");

    await ctx.db.patch(projectId, { defaultAssignees });
  },
});

/**
 * Toggle retainer active/inactive status. Admin only.
 */
export const toggleRetainerStatus = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const project = await ctx.db.get(id);
    if (!project) throw new Error("Project not found");
    if (project.billingType !== "retainer") {
      throw new Error("Only retainer projects have active/inactive status");
    }

    const newStatus =
      project.retainerStatus === "active" ? "inactive" : "active";
    await ctx.db.patch(id, { retainerStatus: newStatus });
  },
});

/**
 * Archive a project. Admin only.
 * Cascades to tasks and auto-stops timers.
 */
export const archive = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const project = await ctx.db.get(id);
    if (!project) throw new Error("Project not found");
    if (project.isArchived) return;

    await ctx.db.patch(id, { isArchived: true });

    // Cascade to tasks
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_projectId", (q) => q.eq("projectId", id))
      .collect();

    for (const task of tasks) {
      if (!task.isArchived) {
        await ctx.db.patch(task._id, { isArchived: true });
      }
    }

    // Auto-stop running timers on tasks in this project
    const allUsers = await ctx.db.query("users").collect();
    for (const user of allUsers) {
      if (user.timerTaskId && user.timerStartedAt) {
        const timerTask = await ctx.db.get(user.timerTaskId);
        if (timerTask?.projectId === id) {
          await stopUserTimer(ctx, user);
        }
      }
    }
  },
});

/**
 * List all projects with computed health metrics for the projects overview page.
 * Collects all data in bulk to avoid N+1 queries.
 */
export const listAllWithMetrics = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, { includeArchived }) => {
    const user = await requireAuth(ctx);
    const admin = isAdmin(user);

    const allProjects = await ctx.db.query("projects").collect();
    const projects = includeArchived
      ? allProjects
      : allProjects.filter((p) => !p.isArchived);

    if (projects.length === 0) return [];

    // Bulk-collect all related data
    const allClients = await ctx.db.query("clients").collect();
    const allTasks = await ctx.db.query("tasks").collect();
    const allTimeEntries = await ctx.db.query("timeEntries").collect();
    const allEstimates = await ctx.db
      .query("projectCategoryEstimates")
      .collect();
    const allRetainerPeriods = await ctx.db
      .query("retainerPeriods")
      .collect();
    const allWorkCategories = await ctx.db
      .query("workCategories")
      .collect();
    const categoryNameMap = new Map(
      allWorkCategories.map((c) => [c._id, c.name]),
    );

    // Build lookup maps
    const clientMap = new Map(allClients.map((c) => [c._id, c]));

    // Tasks by projectId
    const tasksByProject = new Map<string, typeof allTasks>();
    for (const task of allTasks) {
      if (!task.projectId) continue;
      const list = tasksByProject.get(task.projectId) ?? [];
      list.push(task);
      tasksByProject.set(task.projectId, list);
    }

    // Time entries by taskId
    const entriesByTask = new Map<string, typeof allTimeEntries>();
    for (const entry of allTimeEntries) {
      const list = entriesByTask.get(entry.taskId) ?? [];
      list.push(entry);
      entriesByTask.set(entry.taskId, list);
    }

    // Estimates by projectId
    const estimatesByProject = new Map<string, typeof allEstimates>();
    for (const est of allEstimates) {
      const list = estimatesByProject.get(est.projectId) ?? [];
      list.push(est);
      estimatesByProject.set(est.projectId, list);
    }

    // Current month prefix for retainer burn calc
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // 14 days ago for activity check
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysAgoStr = `${fourteenDaysAgo.getFullYear()}-${String(fourteenDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(fourteenDaysAgo.getDate()).padStart(2, "0")}`;

    return projects.map((project) => {
      const client = clientMap.get(project.clientId);
      const tasks = tasksByProject.get(project._id) ?? [];

      // Gather all time entries for this project's tasks
      let totalMinutes = 0;
      let currentMonthMinutes = 0;
      let uninvoicedMinutes = 0;
      let lastActivityDate: string | null = null;

      for (const task of tasks) {
        const entries = entriesByTask.get(task._id) ?? [];
        for (const entry of entries) {
          totalMinutes += entry.durationMinutes;

          if (entry.date.startsWith(currentMonthPrefix)) {
            currentMonthMinutes += entry.durationMinutes;
          }

          // T&M uninvoiced: entries after lastInvoicedAt (or all if never invoiced)
          if (project.billingType === "t_and_m") {
            if (!project.lastInvoicedAt || entry.date > project.lastInvoicedAt) {
              uninvoicedMinutes += entry.durationMinutes;
            }
          }

          if (!lastActivityDate || entry.date > lastActivityDate) {
            lastActivityDate = entry.date;
          }
        }
      }

      // Budget minutes + retainer rollover
      let budgetMinutes: number | null = null;
      let rolloverMinutes = 0;
      let overageMinutes = 0;
      let categoryBreakdown: Array<{
        categoryName: string;
        estimatedMinutes: number;
        actualMinutes: number;
      }> | null = null;

      if (project.billingType === "fixed") {
        const estimates = estimatesByProject.get(project._id) ?? [];
        if (estimates.length > 0) {
          const total = estimates.reduce(
            (sum, e) => sum + e.estimatedMinutes,
            0,
          );
          budgetMinutes = total > 0 ? total : null;
        }

        // Per-category breakdown
        const categoryActuals = new Map<string, number>();
        for (const task of tasks) {
          if (!task.workCategoryId || task.isArchived) continue;
          const entries = entriesByTask.get(task._id) ?? [];
          const sum = entries.reduce((s, e) => s + e.durationMinutes, 0);
          categoryActuals.set(
            task.workCategoryId,
            (categoryActuals.get(task.workCategoryId) ?? 0) + sum,
          );
        }
        if (estimates.length > 0) {
          categoryBreakdown = estimates.map((est) => ({
            categoryName:
              categoryNameMap.get(est.workCategoryId) ?? "Unknown",
            estimatedMinutes: est.estimatedMinutes,
            actualMinutes:
              categoryActuals.get(est.workCategoryId) ?? 0,
          }));
        }
      } else if (project.billingType === "retainer") {
        // Find current month's retainer period for rollover
        const currentPeriod = allRetainerPeriods.find(
          (p) =>
            p.projectId === project._id &&
            currentMonthPrefix >= p.periodStart.slice(0, 7) &&
            currentMonthPrefix <= p.periodEnd.slice(0, 7),
        );
        if (currentPeriod) {
          budgetMinutes =
            currentPeriod.includedMinutes + currentPeriod.rolloverMinutes;
          rolloverMinutes = currentPeriod.rolloverMinutes;
        } else {
          budgetMinutes = project.includedHoursPerMonth ?? null;
        }
        overageMinutes =
          budgetMinutes
            ? Math.max(0, currentMonthMinutes - budgetMinutes)
            : 0;
      }

      // Burn percent
      let burnPercent: number | null = null;
      if (project.billingType === "fixed" && budgetMinutes && budgetMinutes > 0) {
        burnPercent = Math.round((totalMinutes / budgetMinutes) * 100);
      } else if (
        project.billingType === "retainer" &&
        budgetMinutes &&
        budgetMinutes > 0
      ) {
        burnPercent = Math.round(
          (currentMonthMinutes / budgetMinutes) * 100,
        );
      }

      // Health status
      const hasRecentActivity =
        lastActivityDate !== null && lastActivityDate >= fourteenDaysAgoStr;

      let healthStatus: string;
      if (!hasRecentActivity && totalMinutes > 0) {
        healthStatus = "no_activity";
      } else if (project.billingType === "t_and_m") {
        healthStatus = hasRecentActivity ? "on_track" : "no_activity";
      } else if (burnPercent !== null && burnPercent > 100) {
        healthStatus = "over_budget";
      } else if (burnPercent !== null && burnPercent >= 80) {
        healthStatus = "at_risk";
      } else if (totalMinutes === 0 && !hasRecentActivity) {
        healthStatus = "no_activity";
      } else {
        healthStatus = "on_track";
      }

      const activeTaskCount = tasks.filter((t) => !t.isArchived).length;

      const base = {
        _id: project._id,
        _creationTime: project._creationTime,
        name: project.name,
        billingType: project.billingType,
        isArchived: project.isArchived,
        retainerStatus: project.retainerStatus,
        clientId: project.clientId,
        clientName: client?.name ?? "Unknown",
        clientCurrency: client?.currency ?? "USD",
        totalMinutes,
        activeTaskCount,
        healthStatus,
        lastActivityDate,
      };

      if (!admin) return base;

      return {
        ...base,
        lastInvoicedAt: project.lastInvoicedAt ?? null,
        currentMonthMinutes,
        uninvoicedMinutes,
        budgetMinutes,
        burnPercent,
        rolloverMinutes,
        overageMinutes,
        categoryBreakdown,
      };
    });
  },
});

/**
 * Mark a T&M project as invoiced (sets lastInvoicedAt to today). Admin only.
 */
export const markInvoiced = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const project = await ctx.db.get(id);
    if (!project) throw new Error("Project not found");

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    await ctx.db.patch(id, { lastInvoicedAt: dateStr });
  },
});

/**
 * Unarchive a project. Admin only.
 */
export const unarchive = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const project = await ctx.db.get(id);
    if (!project) throw new Error("Project not found");
    await ctx.db.patch(id, { isArchived: false });
  },
});
