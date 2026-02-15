import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireAuth } from "./lib/permissions";

/**
 * List clients with active project count and hours logged this month.
 * Admin only. Supports filtering archived/active.
 */
export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, { includeArchived }) => {
    await requireAdmin(ctx);

    const allClients = await ctx.db.query("clients").collect();
    const clients = includeArchived
      ? allClients
      : allClients.filter((c) => !c.isArchived);

    // Current month range for hours calculation
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const monthStart = `${year}-${month}-01`;
    const nextMonth = now.getMonth() + 1 === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

    // Fetch all projects once, group by client
    const allProjects = await ctx.db.query("projects").collect();
    const projectsByClient = new Map<string, typeof allProjects>();
    for (const project of allProjects) {
      const existing = projectsByClient.get(project.clientId) ?? [];
      existing.push(project);
      projectsByClient.set(project.clientId, existing);
    }

    // Build set of all project IDs across all listed clients
    const clientIds = new Set(clients.map((c) => c._id));
    const relevantProjectIds = new Set<string>();
    for (const project of allProjects) {
      if (clientIds.has(project.clientId)) {
        relevantProjectIds.add(project._id);
      }
    }

    // Fetch tasks only for relevant projects using index
    const tasksByProject = new Map<string, string[]>();
    for (const projectId of relevantProjectIds) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId as any))
        .collect();
      tasksByProject.set(projectId, tasks.map((t) => t._id));
    }

    // Fetch time entries for each task and filter by month
    const minutesByTask = new Map<string, number>();
    for (const taskIds of tasksByProject.values()) {
      for (const taskId of taskIds) {
        const entries = await ctx.db
          .query("timeEntries")
          .withIndex("by_taskId", (q) => q.eq("taskId", taskId as any))
          .collect();
        const monthMinutes = entries
          .filter((te) => te.date >= monthStart && te.date < nextMonth)
          .reduce((sum, te) => sum + te.durationMinutes, 0);
        if (monthMinutes > 0) {
          minutesByTask.set(taskId, monthMinutes);
        }
      }
    }

    return clients.map((client) => {
      const projects = projectsByClient.get(client._id) ?? [];
      const activeProjectCount = projects.filter((p) => !p.isArchived).length;

      let minutesThisMonth = 0;
      for (const project of projects) {
        const taskIds = tasksByProject.get(project._id) ?? [];
        for (const taskId of taskIds) {
          minutesThisMonth += minutesByTask.get(taskId) ?? 0;
        }
      }

      return {
        ...client,
        activeProjectCount,
        minutesThisMonth,
      };
    });
  },
});

/**
 * Get a single client by ID.
 */
export const get = query({
  args: { id: v.id("clients") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const client = await ctx.db.get(id);
    if (!client) throw new Error("Client not found");
    return client;
  },
});

/**
 * Create a new client. Admin only.
 */
export const create = mutation({
  args: {
    name: v.string(),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const trimmedName = args.name.trim();
    if (!trimmedName) throw new Error("Client name cannot be empty");

    return await ctx.db.insert("clients", {
      name: trimmedName,
      contactName: args.contactName?.trim() || undefined,
      contactEmail: args.contactEmail?.trim() || undefined,
      currency: args.currency.toUpperCase(),
      isArchived: false,
    });
  },
});

/**
 * Update a client. Admin only.
 * Currency is locked after the first project is created (constraint #15).
 */
export const update = mutation({
  args: {
    id: v.id("clients"),
    name: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    await requireAdmin(ctx);
    const client = await ctx.db.get(id);
    if (!client) throw new Error("Client not found");

    // Currency lock check (constraint #15)
    if (updates.currency && updates.currency.toUpperCase() !== client.currency) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_clientId", (q) => q.eq("clientId", id))
        .collect();
      if (projects.length > 0) {
        throw new Error(
          "Currency cannot be changed after projects have been created",
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) throw new Error("Client name cannot be empty");
      patch.name = trimmed;
    }
    if (updates.contactName !== undefined) {
      patch.contactName = updates.contactName.trim() || undefined;
    }
    if (updates.contactEmail !== undefined) {
      patch.contactEmail = updates.contactEmail.trim() || undefined;
    }
    if (updates.currency !== undefined) {
      patch.currency = updates.currency.toUpperCase();
    }

    await ctx.db.patch(id, patch);
  },
});

/**
 * Check if a client's currency is locked (has projects).
 */
export const isCurrencyLocked = query({
  args: { id: v.id("clients") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_clientId", (q) => q.eq("clientId", id))
      .collect();
    return projects.length > 0;
  },
});

/**
 * Archive a client with cascading effects.
 * Archives all projects and tasks. Auto-stops running timers.
 * Uses the undo toast pattern: this mutation is called after the 5-second delay.
 */
export const archive = mutation({
  args: { id: v.id("clients") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const client = await ctx.db.get(id);
    if (!client) throw new Error("Client not found");
    if (client.isArchived) return; // already archived

    // Archive the client
    await ctx.db.patch(id, { isArchived: true });

    // Cascade to projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_clientId", (q) => q.eq("clientId", id))
      .collect();

    for (const project of projects) {
      if (!project.isArchived) {
        await ctx.db.patch(project._id, { isArchived: true });
      }

      // Cascade to tasks
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .collect();

      for (const task of tasks) {
        if (!task.isArchived) {
          await ctx.db.patch(task._id, { isArchived: true });
        }
      }
    }

    // Auto-stop running timers on this client's tasks
    const allUsers = await ctx.db.query("users").collect();
    const projectIds = new Set(projects.map((p) => p._id));

    for (const user of allUsers) {
      if (user.timerTaskId && user.timerStartedAt) {
        const timerTask = await ctx.db.get(user.timerTaskId);
        if (timerTask?.projectId && projectIds.has(timerTask.projectId)) {
          // Stop timer and save time entry
          const now = Date.now();
          const elapsedMs = now - user.timerStartedAt;
          const elapsedMinutes = Math.ceil(elapsedMs / 60000);

          if (elapsedMinutes > 0) {
            const today = new Date(now);
            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            await ctx.db.insert("timeEntries", {
              taskId: user.timerTaskId,
              userId: user._id,
              date: dateStr,
              durationMinutes: elapsedMinutes,
              method: "timer",
            });
          }

          await ctx.db.patch(user._id, {
            timerTaskId: undefined,
            timerStartedAt: undefined,
          });
        }
      }
    }
  },
});

/**
 * Unarchive a client. Does NOT unarchive projects/tasks (admin does that manually).
 */
export const unarchive = mutation({
  args: { id: v.id("clients") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const client = await ctx.db.get(id);
    if (!client) throw new Error("Client not found");
    await ctx.db.patch(id, { isArchived: false });
  },
});

/**
 * Permanently delete a client.
 * Blocked if any projects have time entries.
 * Requires confirmation modal on the frontend.
 */
export const remove = mutation({
  args: { id: v.id("clients") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const client = await ctx.db.get(id);
    if (!client) throw new Error("Client not found");

    // Check if any projects have time entries
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_clientId", (q) => q.eq("clientId", id))
      .collect();

    for (const project of projects) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .collect();

      for (const task of tasks) {
        const timeEntries = await ctx.db
          .query("timeEntries")
          .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
          .first();

        if (timeEntries) {
          throw new Error(
            "Cannot delete client: projects have logged time entries. Archive instead.",
          );
        }
      }
    }

    // Delete all related data (no time entries, so safe to delete)
    for (const project of projects) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .collect();

      for (const task of tasks) {
        // Delete comments, attachments, activity log, notifications related to task
        const comments = await ctx.db
          .query("comments")
          .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
          .collect();
        for (const comment of comments) await ctx.db.delete(comment._id);

        const attachments = await ctx.db
          .query("attachments")
          .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
          .collect();
        for (const attachment of attachments) await ctx.db.delete(attachment._id);

        const logs = await ctx.db
          .query("activityLogEntries")
          .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
          .collect();
        for (const log of logs) await ctx.db.delete(log._id);

        await ctx.db.delete(task._id);
      }

      // Delete project category estimates
      const estimates = await ctx.db
        .query("projectCategoryEstimates")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .collect();
      for (const estimate of estimates) await ctx.db.delete(estimate._id);

      // Delete retainer periods
      const periods = await ctx.db
        .query("retainerPeriods")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .collect();
      for (const period of periods) await ctx.db.delete(period._id);

      await ctx.db.delete(project._id);
    }

    // Delete timesheets
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_clientId", (q) => q.eq("clientId", id))
      .collect();
    for (const ts of timesheets) await ctx.db.delete(ts._id);

    await ctx.db.delete(id);
  },
});
