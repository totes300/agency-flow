/**
 * Time Measurement Integrity Tests
 *
 * These tests validate that time tracking is accurate end-to-end:
 * task totals, project totals, timer rounding, retainer usage,
 * and multi-user / multi-task aggregation.
 *
 * If any of these fail, billing data is wrong and we lose client trust.
 */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────

async function setupClientProject(asAdmin: any, opts?: { billingType?: string; includedHoursPerMonth?: number }) {
  const clientId = await asAdmin.mutation(api.clients.create, { name: "Acme Corp", currency: "USD" });
  const projectId = await asAdmin.mutation(api.projects.create, {
    clientId,
    name: "Website Redesign",
    billingType: opts?.billingType ?? "t_and_m",
    ...(opts?.includedHoursPerMonth !== undefined ? { includedHoursPerMonth: opts.includedHoursPerMonth } : {}),
  });
  return { clientId, projectId };
}

async function addEntry(asUser: any, taskId: string, minutes: number, date: string, note?: string) {
  return asUser.mutation(api.timeEntries.create, {
    taskId,
    durationMinutes: minutes,
    date,
    ...(note ? { note } : {}),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. TASK-LEVEL TIME TOTALS
// ═══════════════════════════════════════════════════════════════════════════

describe("Task totalMinutes accuracy", () => {
  it("sums multiple entries on the same task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Design", projectId });

    await addEntry(asAdmin, taskId, 30, "2025-06-10");
    await addEntry(asAdmin, taskId, 45, "2025-06-10");
    await addEntry(asAdmin, taskId, 120, "2025-06-11");

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(195); // 30 + 45 + 120
  });

  it("returns 0 when no entries exist", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Empty Task", projectId });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(0);
  });

  it("reflects deleted entries (total decreases)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const entry1 = await addEntry(asAdmin, taskId, 60, "2025-06-10");
    await addEntry(asAdmin, taskId, 30, "2025-06-10");

    let task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(90);

    await asAdmin.mutation(api.timeEntries.remove, { id: entry1 });

    task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(30);
  });

  it("reflects updated entries", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const entryId = await addEntry(asAdmin, taskId, 60, "2025-06-10");

    await asAdmin.mutation(api.timeEntries.update, { id: entryId, durationMinutes: 90 });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(90);
  });

  it("includes entries from multiple users", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Shared Task", projectId, assigneeIds: [memberUser!._id],
    });

    await addEntry(asAdmin, taskId, 60, "2025-06-10");
    await addEntry(asMember, taskId, 45, "2025-06-10");

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(105); // 60 + 45
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. SUBTASK TIME ROLLS UP TO PARENT
// ═══════════════════════════════════════════════════════════════════════════

describe("Subtask time aggregation", () => {
  it("parent.subtaskTotalMinutes includes subtask entries", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const parentId = await asAdmin.mutation(api.tasks.create, { title: "Parent", projectId });
    const child1 = await asAdmin.mutation(api.tasks.create, { title: "Child 1", projectId, parentTaskId: parentId });
    const child2 = await asAdmin.mutation(api.tasks.create, { title: "Child 2", projectId, parentTaskId: parentId });

    await addEntry(asAdmin, parentId, 30, "2025-06-10");
    await addEntry(asAdmin, child1, 60, "2025-06-10");
    await addEntry(asAdmin, child2, 45, "2025-06-11");

    const parent = await asAdmin.query(api.tasks.get, { id: parentId });
    expect(parent.totalMinutes).toBe(30);             // own entries
    expect(parent.subtaskTotalMinutes).toBe(105);      // 60 + 45
  });

  it("subtask with no entries contributes 0", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const parentId = await asAdmin.mutation(api.tasks.create, { title: "Parent", projectId });
    await asAdmin.mutation(api.tasks.create, { title: "Empty Child", projectId, parentTaskId: parentId });

    await addEntry(asAdmin, parentId, 60, "2025-06-10");

    const parent = await asAdmin.query(api.tasks.get, { id: parentId });
    expect(parent.totalMinutes).toBe(60);
    expect(parent.subtaskTotalMinutes).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. PROJECT-LEVEL TIME TOTALS
// ═══════════════════════════════════════════════════════════════════════════

describe("Project totalMinutes accuracy", () => {
  it("sums across all tasks in the project", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const task1 = await asAdmin.mutation(api.tasks.create, { title: "Task A", projectId });
    const task2 = await asAdmin.mutation(api.tasks.create, { title: "Task B", projectId });
    const task3 = await asAdmin.mutation(api.tasks.create, { title: "Task C", projectId });

    await addEntry(asAdmin, task1, 60, "2025-06-10");
    await addEntry(asAdmin, task2, 120, "2025-06-10");
    await addEntry(asAdmin, task3, 30, "2025-06-11");

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.totalMinutes).toBe(210); // 60 + 120 + 30
  });

  it("excludes archived tasks from project total", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const active = await asAdmin.mutation(api.tasks.create, { title: "Active", projectId });
    const toArchive = await asAdmin.mutation(api.tasks.create, { title: "Archived", projectId });

    await addEntry(asAdmin, active, 60, "2025-06-10");
    await addEntry(asAdmin, toArchive, 120, "2025-06-10");

    // Archive the task
    await asAdmin.mutation(api.tasks.archive, { id: toArchive });

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.totalMinutes).toBe(60); // only active task
  });

  it("project with no tasks has 0 minutes", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.totalMinutes).toBe(0);
  });

  it("includes entries from subtasks in project total", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const parent = await asAdmin.mutation(api.tasks.create, { title: "Parent", projectId });
    const child = await asAdmin.mutation(api.tasks.create, { title: "Child", projectId, parentTaskId: parent });

    await addEntry(asAdmin, parent, 30, "2025-06-10");
    await addEntry(asAdmin, child, 60, "2025-06-10");

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    // Subtask is its own task in the DB, so both are counted
    expect(project.totalMinutes).toBe(90);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. TIMER DURATION ACCURACY
// ═══════════════════════════════════════════════════════════════════════════

describe("Timer duration calculation", () => {
  it("rounds UP to nearest minute (constraint #3)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Timer Task", projectId });

    // Simulate 2 minutes 10 seconds (should round up to 3m)
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - (2 * 60 * 1000 + 10 * 1000) });
    });

    const result = await asAdmin.mutation(api.timer.stop, {});
    expect(result.durationMinutes).toBe(3); // Math.ceil(130/60) = 3
  });

  it("exact minutes don't over-round", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Timer Task", projectId });

    // Simulate exactly 5 minutes
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 5 * 60 * 1000 });
    });

    const result = await asAdmin.mutation(api.timer.stop, {});
    expect(result.durationMinutes).toBe(5);
  });

  it("timer entry appears in task.totalMinutes", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Timer Task", projectId });

    // Add a manual entry first
    await addEntry(asAdmin, taskId, 30, "2025-06-10");

    // Then simulate a timer stop (10 minutes)
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 10 * 60 * 1000 });
    });
    const stopResult = await asAdmin.mutation(api.timer.stop, {});

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    // Timer uses Math.ceil, so may round up by 1m due to test execution time
    expect(task.totalMinutes).toBe(30 + stopResult.durationMinutes);
  });

  it("timer entry appears in project totalMinutes", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Timer Task", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 15 * 60 * 1000 });
    });
    await asAdmin.mutation(api.timer.stop, {});

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.totalMinutes).toBe(15);
  });

  it("auto-stop on task switch creates correct entry for previous task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const task1 = await asAdmin.mutation(api.tasks.create, { title: "Task 1", projectId });
    const task2 = await asAdmin.mutation(api.tasks.create, { title: "Task 2", projectId });

    // Start timer on task1 (8 minutes ago)
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: task1, timerStartedAt: Date.now() - 8 * 60 * 1000 });
    });

    // Switch to task2 (auto-stops task1)
    const result = await asAdmin.mutation(api.timer.start, { taskId: task2 });
    expect(result.previousElapsedMinutes).toBe(8);

    // Verify task1 has the time entry
    const t1 = await asAdmin.query(api.tasks.get, { id: task1 });
    expect(t1.totalMinutes).toBe(8);

    // Verify timer is now on task2
    const status = await asAdmin.query(api.timer.getStatus, {});
    expect(status.isRunning).toBe(true);
    expect(status.taskId).toBe(task2);
  });

  it("sub-minute timer (no save) does NOT create entry", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Quick Task", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 15 * 1000 });
    });

    const result = await asAdmin.mutation(api.timer.stop, {});
    expect(result.durationMinutes).toBe(0);

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(0);
  });

  it("discard does NOT create entry", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Discard Task", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 30 * 60 * 1000 });
    });

    await asAdmin.mutation(api.timer.discard, {});

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. VALIDATION — PREVENTS CORRUPT DATA
// ═══════════════════════════════════════════════════════════════════════════

describe("Time entry validation guards", () => {
  it("rejects zero duration", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await expect(
      addEntry(asAdmin, taskId, 0, "2025-06-10"),
    ).rejects.toThrow("Duration must be a positive integer");
  });

  it("rejects negative duration", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await expect(
      addEntry(asAdmin, taskId, -30, "2025-06-10"),
    ).rejects.toThrow("Duration must be a positive integer");
  });

  it("rejects float duration", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await expect(
      addEntry(asAdmin, taskId, 1.5, "2025-06-10"),
    ).rejects.toThrow("Duration must be a positive integer");
  });

  it("rejects invalid date format", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await expect(
      addEntry(asAdmin, taskId, 60, "06/10/2025"),
    ).rejects.toThrow("Date must be in YYYY-MM-DD format");
  });

  it("rejects entry on task without project (constraint #9)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Orphan Task" });

    await expect(
      addEntry(asAdmin, taskId, 30, "2025-06-10"),
    ).rejects.toThrow("Task must have a project");
  });

  it("rejects zero duration on update", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const entryId = await addEntry(asAdmin, taskId, 60, "2025-06-10");

    await expect(
      asAdmin.mutation(api.timeEntries.update, { id: entryId, durationMinutes: 0 }),
    ).rejects.toThrow("Duration must be a positive integer");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. RETAINER USAGE — COMPUTED FROM TIME ENTRIES
// ═══════════════════════════════════════════════════════════════════════════

describe("Retainer usage computed from time entries (constraint #24)", () => {
  it("usedMinutes matches sum of entries in the month", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await asAdmin.mutation(api.clients.create, { name: "Retainer Client", currency: "USD" });
    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Retainer Project",
      billingType: "retainer",
      includedHoursPerMonth: 600, // 600 minutes = 10h
    });
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Monthly Work", projectId });

    // Add entries in June 2025
    await addEntry(asAdmin, taskId, 120, "2025-06-05");
    await addEntry(asAdmin, taskId, 60, "2025-06-15");
    await addEntry(asAdmin, taskId, 30, "2025-06-28");

    // Also add one in July (should NOT count for June)
    await addEntry(asAdmin, taskId, 90, "2025-07-01");

    const usage = await asAdmin.query(api.retainerPeriods.getUsage, {
      projectId,
      yearMonth: "2025-06",
    });

    expect(usage.usedMinutes).toBe(210); // 120 + 60 + 30, NOT 300
  });

  it("entries on different tasks within same project all count", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await asAdmin.mutation(api.clients.create, { name: "Multi-Task Client", currency: "USD" });
    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Retainer",
      billingType: "retainer",
      includedHoursPerMonth: 1200,
    });
    const task1 = await asAdmin.mutation(api.tasks.create, { title: "Task A", projectId });
    const task2 = await asAdmin.mutation(api.tasks.create, { title: "Task B", projectId });

    await addEntry(asAdmin, task1, 60, "2025-06-10");
    await addEntry(asAdmin, task2, 90, "2025-06-10");

    const usage = await asAdmin.query(api.retainerPeriods.getUsage, {
      projectId,
      yearMonth: "2025-06",
    });

    expect(usage.usedMinutes).toBe(150);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. MULTI-USER TIME ISOLATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Multi-user time tracking", () => {
  it("entries from different users on same task all count toward total", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Collab Task", projectId, assigneeIds: [memberUser!._id],
    });

    // Admin logs 2h, member logs 1h 30m
    await addEntry(asAdmin, taskId, 120, "2025-06-10");
    await addEntry(asMember, taskId, 90, "2025-06-10");

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(210);

    // Project total also correct
    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.totalMinutes).toBe(210);
  });

  it("timers for different users are independent", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task", projectId, assigneeIds: [memberUser!._id],
    });

    // Both start timer on the same task
    await asAdmin.mutation(api.timer.start, { taskId });
    await asMember.mutation(api.timer.start, { taskId });

    // Verify both timers are running independently
    const adminStatus = await asAdmin.query(api.timer.getStatus, {});
    const memberStatus = await asMember.query(api.timer.getStatus, {});
    expect(adminStatus.isRunning).toBe(true);
    expect(memberStatus.isRunning).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. NOTE PRESERVATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Time entry notes", () => {
  it("stores and returns notes on entries", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await addEntry(asAdmin, taskId, 60, "2025-06-10", "Client call");

    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page[0].note).toBe("Client call");
  });

  it("entry without note has undefined note", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await addEntry(asAdmin, taskId, 60, "2025-06-10");

    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page[0].note).toBeUndefined();
  });

  it("note can be updated", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const entryId = await addEntry(asAdmin, taskId, 60, "2025-06-10", "Original");

    await asAdmin.mutation(api.timeEntries.update, { id: entryId, note: "Updated note" });

    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page[0].note).toBe("Updated note");
  });

  it("note can be cleared", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const entryId = await addEntry(asAdmin, taskId, 60, "2025-06-10", "To be removed");

    await asAdmin.mutation(api.timeEntries.update, { id: entryId, note: null });

    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page[0].note).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. EDGE CASES — LARGE VOLUMES & BOUNDARY CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("Edge cases", () => {
  it("many small entries sum correctly (no floating point drift)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Many Entries", projectId });

    // 20 entries of 7 minutes each = 140 total
    for (let i = 0; i < 20; i++) {
      await addEntry(asAdmin, taskId, 7, `2025-06-${String(i + 1).padStart(2, "0")}`);
    }

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(140);
  });

  it("very large entry (full workday)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Long Task", projectId });

    await addEntry(asAdmin, taskId, 480, "2025-06-10"); // 8h

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(480);
  });

  it("entries across different months on same task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Cross-Month", projectId });

    await addEntry(asAdmin, taskId, 60, "2025-05-31");
    await addEntry(asAdmin, taskId, 60, "2025-06-01");
    await addEntry(asAdmin, taskId, 60, "2025-06-30");
    await addEntry(asAdmin, taskId, 60, "2025-07-01");

    // Task total includes all months
    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.totalMinutes).toBe(240);

    // Project total includes all months
    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.totalMinutes).toBe(240);
  });
});
