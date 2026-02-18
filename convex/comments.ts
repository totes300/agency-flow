import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, isAdmin } from "./lib/permissions";
import { logActivity } from "./lib/activityLogger";

export const list = query({
  args: {
    taskId: v.id("tasks"),
    paginationOpts: v.optional(v.object({
      cursor: v.optional(v.string()),
      numItems: v.optional(v.number()),
    })),
  },
  handler: async (ctx, { taskId, paginationOpts }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) throw new Error("Access denied");

    const numItems = paginationOpts?.numItems ?? 50;
    let comments = await ctx.db.query("comments")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId)).collect();
    comments.sort((a, b) => b._creationTime - a._creationTime);

    const cursorTime = paginationOpts?.cursor ? parseFloat(paginationOpts.cursor) : Infinity;
    const afterCursor = comments.filter((c) => c._creationTime < cursorTime);
    const page = afterCursor.slice(0, numItems);
    const hasMore = afterCursor.length > numItems;
    const nextCursor = page.length > 0 ? String(page[page.length - 1]._creationTime) : undefined;

    const userMap = new Map<string, { name: string; avatarUrl?: string }>();
    const allUsers = await ctx.db.query("users").collect();
    for (const u of allUsers) userMap.set(u._id, { name: u.name, avatarUrl: u.avatarUrl });

    return {
      page: page.map((c) => {
        const cu = userMap.get(c.userId);
        return { ...c, userName: cu?.name ?? "Unknown", userAvatarUrl: cu?.avatarUrl };
      }),
      continueCursor: nextCursor ?? "",
      isDone: !hasMore,
    };
  },
});

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    content: v.any(),
    mentionedUserIds: v.array(v.id("users")),
  },
  handler: async (ctx, { taskId, content, mentionedUserIds }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) throw new Error("Access denied");

    const commentId = await ctx.db.insert("comments", {
      taskId, userId: user._id, content, mentionedUserIds,
    });

    for (const mentionedId of mentionedUserIds) {
      if (mentionedId === user._id) continue;
      await ctx.db.insert("notifications", {
        userId: mentionedId,
        type: "mention",
        relatedEntityId: taskId,
        relatedEntityType: "task",
        message: `${user.name} mentioned you in a comment on "${task.title}"`,
        isRead: false,
      });
    }

    await logActivity(ctx, {
      taskId, userId: user._id, action: "added a comment",
    });

    return commentId;
  },
});

export const remove = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, { id }) => {
    const user = await requireAuth(ctx);
    const comment = await ctx.db.get(id);
    if (!comment) throw new Error("Comment not found");
    if (comment.userId !== user._id && !isAdmin(user)) throw new Error("Access denied");

    await logActivity(ctx, {
      taskId: comment.taskId, userId: user._id, action: "deleted a comment",
    });

    await ctx.db.delete(id);
  },
});
