import { MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

const MAX_TIMER_MINUTES = 16 * 60; // 16 hours

/**
 * Stop a user's running timer, creating a time entry if elapsed > 0.
 * Shared across tasks.ts, timer.ts, clients.ts, projects.ts.
 */
export async function stopUserTimer(
  ctx: MutationCtx,
  user: Doc<"users">,
): Promise<{ elapsedMinutes: number } | null> {
  if (!user.timerTaskId || !user.timerStartedAt) return null;

  const now = Date.now();
  const elapsedMs = now - user.timerStartedAt;
  const elapsedMinutes = Math.min(Math.ceil(elapsedMs / 60000), MAX_TIMER_MINUTES);

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

  return { elapsedMinutes };
}
