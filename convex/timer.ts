import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, isAdmin } from "./lib/permissions";

const MAX_TIMER_MINUTES = 16 * 60; // 16 hours

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (!user.timerTaskId || !user.timerStartedAt) {
      return { isRunning: false as const };
    }

    const task = await ctx.db.get(user.timerTaskId);
    let projectName: string | null = null;
    if (task?.projectId) {
      const project = await ctx.db.get(task.projectId);
      projectName = project?.name ?? null;
    }

    return {
      isRunning: true as const,
      taskId: user.timerTaskId,
      taskTitle: task?.title ?? "Unknown Task",
      projectName,
      startedAt: user.timerStartedAt,
    };
  },
});

export const start = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const user = await requireAuth(ctx);

    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    if (!task.projectId) {
      throw new Error("Task must have a project before starting timer");
    }

    // No-op if same task already running
    if (user.timerTaskId === taskId) {
      return { previousTaskTitle: undefined, previousElapsedMinutes: undefined };
    }

    // Auto-stop previous timer
    let previousTaskTitle: string | undefined;
    let previousElapsedMinutes: number | undefined;

    if (user.timerTaskId && user.timerStartedAt) {
      const prevTask = await ctx.db.get(user.timerTaskId);
      previousTaskTitle = prevTask?.title;

      const now = Date.now();
      const elapsedMs = now - user.timerStartedAt;
      const elapsedMinutes = Math.min(Math.ceil(elapsedMs / 60000), MAX_TIMER_MINUTES);
      previousElapsedMinutes = elapsedMinutes;

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

        await ctx.runMutation(internal.activityLog.log, {
          taskId: user.timerTaskId,
          userId: user._id,
          action: `stopped timer (${elapsedMinutes}m)`,
        });
      }
    }

    // Start new timer
    await ctx.db.patch(user._id, {
      timerTaskId: taskId,
      timerStartedAt: Date.now(),
    });

    await ctx.runMutation(internal.activityLog.log, {
      taskId,
      userId: user._id,
      action: "started timer",
    });

    return { previousTaskTitle, previousElapsedMinutes };
  },
});

export const stop = mutation({
  args: { saveIfUnderOneMinute: v.optional(v.boolean()) },
  handler: async (ctx, { saveIfUnderOneMinute }) => {
    const user = await requireAuth(ctx);

    if (!user.timerTaskId || !user.timerStartedAt) {
      throw new Error("No timer running");
    }

    const now = Date.now();
    const elapsedMs = now - user.timerStartedAt;
    const elapsedMinutes = Math.min(Math.ceil(elapsedMs / 60000), MAX_TIMER_MINUTES);

    const taskId = user.timerTaskId;
    const task = await ctx.db.get(taskId);
    const taskTitle = task?.title ?? "Unknown Task";

    // Clear timer
    await ctx.db.patch(user._id, {
      timerTaskId: undefined,
      timerStartedAt: undefined,
    });

    // Sub-minute: return 0 so UI can offer save/discard
    if (elapsedMs < 60000 && !saveIfUnderOneMinute) {
      return { durationMinutes: 0, taskTitle };
    }

    // Create time entry (uses server timestamp per constraint #4)
    const today = new Date(now);
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await ctx.db.insert("timeEntries", {
      taskId,
      userId: user._id,
      date: dateStr,
      durationMinutes: elapsedMinutes,
      method: "timer",
    });

    await ctx.runMutation(internal.activityLog.log, {
      taskId,
      userId: user._id,
      action: `stopped timer (${elapsedMinutes}m)`,
    });

    return { durationMinutes: elapsedMinutes, taskTitle };
  },
});

export const discard = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (!user.timerTaskId) {
      throw new Error("No timer running");
    }

    await ctx.db.patch(user._id, {
      timerTaskId: undefined,
      timerStartedAt: undefined,
    });
  },
});
