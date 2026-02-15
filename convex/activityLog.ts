import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireAuth, isAdmin } from "./lib/permissions";

/**
 * List activity log entries for a task, newest first, paginated.
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

    // Collect and sort by _creationTime descending
    let entries = await ctx.db
      .query("activityLogEntries")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .collect();

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
 * Internal mutation to log an activity event on a task.
 */
export const log = internalMutation({
  args: {
    taskId: v.id("tasks"),
    userId: v.id("users"),
    action: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { taskId, userId, action, metadata }) => {
    await ctx.db.insert("activityLogEntries", {
      taskId,
      userId,
      action,
      metadata,
    });
  },
});
