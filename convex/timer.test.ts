import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

async function setupClientProject(asAdmin: any) {
  const clientId = await asAdmin.mutation(api.clients.create, { name: "Test Client", currency: "USD" });
  const projectId = await asAdmin.mutation(api.projects.create, { clientId, name: "Test Project", billingType: "fixed" });
  return { clientId, projectId };
}

describe("timer.start", () => {
  it("sets timerTaskId + timerStartedAt", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await asAdmin.mutation(api.timer.start, { taskId });

    const status = await asAdmin.query(api.timer.getStatus, {});
    expect(status.isRunning).toBe(true);
    expect(status.taskId).toBe(taskId);
    expect(status.taskTitle).toBe("Task");
  });

  it("blocked without project", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "No Project" });

    await expect(asAdmin.mutation(api.timer.start, { taskId })).rejects.toThrow("Task must have a project");
  });

  it("auto-stops previous, returns previous info", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const task1 = await asAdmin.mutation(api.tasks.create, { title: "Task 1", projectId });
    const task2 = await asAdmin.mutation(api.tasks.create, { title: "Task 2", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: task1, timerStartedAt: Date.now() - 5 * 60 * 1000 });
    });

    const result = await asAdmin.mutation(api.timer.start, { taskId: task2 });
    expect(result.previousTaskTitle).toBe("Task 1");
    expect(result.previousElapsedMinutes).toBeGreaterThanOrEqual(5);

    const status = await asAdmin.query(api.timer.getStatus, {});
    expect(status.taskId).toBe(task2);
  });

  it("no-op on same task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await asAdmin.mutation(api.timer.start, { taskId });
    const result = await asAdmin.mutation(api.timer.start, { taskId });
    expect(result.previousTaskTitle).toBeUndefined();
  });

  it("member blocked on unassigned task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await expect(asMember.mutation(api.timer.start, { taskId })).rejects.toThrow("Access denied");
  });
});

describe("timer.stop", () => {
  it("creates time entry with correct duration/date", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 5 * 60 * 1000 });
    });

    const result = await asAdmin.mutation(api.timer.stop, {});
    expect(result.durationMinutes).toBeGreaterThanOrEqual(5);
    expect(result.taskTitle).toBe("Task");

    const entries = await t.run(async (ctx) => ctx.db.query("timeEntries").collect());
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].method).toBe("timer");
  });

  it("returns durationMinutes=0 for sub-minute", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 10 * 1000 });
    });

    const result = await asAdmin.mutation(api.timer.stop, {});
    expect(result.durationMinutes).toBe(0);
  });

  it("saveIfUnderOneMinute=true creates 1m entry", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 30 * 1000 });
    });

    const result = await asAdmin.mutation(api.timer.stop, { saveIfUnderOneMinute: true });
    expect(result.durationMinutes).toBe(1);
  });
});

describe("timer.discard", () => {
  it("clears timer, no entry", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 3 * 60 * 1000 });
    });

    await asAdmin.mutation(api.timer.discard, {});

    const status = await asAdmin.query(api.timer.getStatus, {});
    expect(status.isRunning).toBe(false);

    const entries = await t.run(async (ctx) => ctx.db.query("timeEntries").collect());
    expect(entries).toHaveLength(0);
  });
});
