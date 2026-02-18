import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, isAdmin } from "./lib/permissions";
import { logActivity } from "./lib/activityLogger";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * List time entries for a task, newest first, paginated.
 */
export const list = query({
  args: {
    taskId: v.id("tasks"),
    paginationOpts: v.optional(
      v.object({
        cursor: v.optional(v.string()),
        numItems: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { taskId, paginationOpts }) => {
    const user = await requireAuth(ctx);

    // Permission: member must be assigned to the task
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    const numItems = paginationOpts?.numItems ?? 50;

    let entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .collect();

    // Newest first
    entries.sort((a, b) => b._creationTime - a._creationTime);

    // Cursor-based pagination
    const cursorTime = paginationOpts?.cursor
      ? parseFloat(paginationOpts.cursor)
      : Infinity;

    const afterCursor = entries.filter((e) => e._creationTime < cursorTime);
    const page = afterCursor.slice(0, numItems);
    const hasMore = afterCursor.length > numItems;
    const nextCursor =
      page.length > 0
        ? String(page[page.length - 1]._creationTime)
        : undefined;

    // Enrich with user info
    const userMap = new Map<string, { name: string; avatarUrl?: string }>();
    const allUsers = await ctx.db.query("users").collect();
    for (const u of allUsers) {
      userMap.set(u._id, { name: u.name, avatarUrl: u.avatarUrl });
    }

    const enriched = page.map((entry) => {
      const entryUser = userMap.get(entry.userId);
      return {
        ...entry,
        userName: entryUser?.name ?? "Unknown",
        userAvatarUrl: entryUser?.avatarUrl,
      };
    });

    return {
      page: enriched,
      continueCursor: nextCursor ?? "",
      isDone: !hasMore,
    };
  },
});

/**
 * Create a manual time entry.
 */
export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    durationMinutes: v.number(),
    date: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { taskId, durationMinutes, date, note }) => {
    const user = await requireAuth(ctx);

    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    // Permission: member must be assigned
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    // Cannot log time on archived tasks
    if (task.isArchived) {
      throw new Error("Cannot log time on an archived task");
    }

    // Constraint #9: task must have a project
    if (!task.projectId) {
      throw new Error("Task must have a project before logging time");
    }

    // Validate duration
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      throw new Error("Duration must be a positive integer (minutes)");
    }

    // Validate date format
    if (!DATE_REGEX.test(date)) {
      throw new Error("Date must be in YYYY-MM-DD format");
    }

    const entryId = await ctx.db.insert("timeEntries", {
      taskId,
      userId: user._id,
      date,
      durationMinutes,
      note: note?.trim() || undefined,
      method: "manual",
    });

    // Log activity
    await logActivity(ctx, {
      taskId,
      userId: user._id,
      action: `logged ${durationMinutes}m`,
    });

    return entryId;
  },
});

/**
 * Update a time entry (own or admin).
 */
export const update = mutation({
  args: {
    id: v.id("timeEntries"),
    durationMinutes: v.optional(v.number()),
    date: v.optional(v.string()),
    note: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...updates }) => {
    const user = await requireAuth(ctx);

    const entry = await ctx.db.get(id);
    if (!entry) throw new Error("Time entry not found");

    // Permission: own or admin
    if (entry.userId !== user._id && !isAdmin(user)) {
      throw new Error("Access denied");
    }

    const patch: Record<string, unknown> = {};

    if (updates.durationMinutes !== undefined) {
      if (
        !Number.isInteger(updates.durationMinutes) ||
        updates.durationMinutes <= 0
      ) {
        throw new Error("Duration must be a positive integer (minutes)");
      }
      patch.durationMinutes = updates.durationMinutes;
    }

    if (updates.date !== undefined) {
      if (!DATE_REGEX.test(updates.date)) {
        throw new Error("Date must be in YYYY-MM-DD format");
      }
      patch.date = updates.date;
    }

    if (updates.note !== undefined) {
      patch.note =
        updates.note === null ? undefined : updates.note.trim() || undefined;
    }

    await ctx.db.patch(id, patch);

    // Log activity for each changed field
    if (updates.durationMinutes !== undefined && updates.durationMinutes !== entry.durationMinutes) {
      await logActivity(ctx, {
        taskId: entry.taskId,
        userId: user._id,
        action: `edited time entry: ${entry.durationMinutes}m → ${updates.durationMinutes}m`,
      });
    }
    if (updates.date !== undefined && updates.date !== entry.date) {
      await logActivity(ctx, {
        taskId: entry.taskId,
        userId: user._id,
        action: `edited time entry date: ${entry.date} → ${updates.date}`,
      });
    }
    if (updates.note !== undefined) {
      const oldNote = entry.note ?? "";
      const newNote = updates.note === null ? "" : (updates.note.trim() || "");
      if (oldNote !== newNote) {
        await logActivity(ctx, {
          taskId: entry.taskId,
          userId: user._id,
          action: newNote ? "edited time entry note" : "removed time entry note",
        });
      }
    }
  },
});

/**
 * Delete a time entry (own or admin).
 */
export const remove = mutation({
  args: { id: v.id("timeEntries") },
  handler: async (ctx, { id }) => {
    const user = await requireAuth(ctx);

    const entry = await ctx.db.get(id);
    if (!entry) throw new Error("Time entry not found");

    // Permission: own or admin
    if (entry.userId !== user._id && !isAdmin(user)) {
      throw new Error("Access denied");
    }

    // Log activity before deletion
    await logActivity(ctx, {
      taskId: entry.taskId,
      userId: user._id,
      action: `deleted ${entry.durationMinutes}m time entry`,
    });

    await ctx.db.delete(id);
  },
});
