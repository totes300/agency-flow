import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";
import { setupAdmin } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

async function createRetainerProject(
  asAdmin: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
  includedMinutes = 600, // 10 hours
  overageRate = 150,
) {
  const clientId = await asAdmin.mutation(api.clients.create, {
    name: "Test Client",
    currency: "USD",
  });
  const projectId = await asAdmin.mutation(api.projects.create, {
    clientId,
    name: "Retainer",
    billingType: "retainer",
    includedHoursPerMonth: includedMinutes,
    overageRate,
  });
  return { clientId, projectId };
}

/** Helper to add a time entry directly for testing */
async function addTimeEntry(
  t: ReturnType<typeof convexTest>,
  taskId: Id<"tasks">,
  date: string,
  durationMinutes: number,
) {
  await t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1"))
      .unique();
    await ctx.db.insert("timeEntries", {
      taskId,
      userId: user!._id,
      date,
      durationMinutes,
      method: "manual",
    });
  });
}

/** Helper to create a task under a project */
async function createTask(
  t: ReturnType<typeof convexTest>,
  projectId: Id<"projects">,
): Promise<Id<"tasks">> {
  let taskId: Id<"tasks">;
  await t.run(async (ctx) => {
    taskId = await ctx.db.insert("tasks", {
      projectId,
      title: "Test Task",
      status: "inbox",
      assigneeIds: [],
      billable: true,
      isArchived: false,
    });
  });
  return taskId!;
}

describe("retainerPeriods.getOrCreateForMonth — lazy creation", () => {
  it("creates a period for the first time", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin);

    const periodId = await asAdmin.mutation(
      api.retainerPeriods.getOrCreateForMonth,
      { projectId, yearMonth: "2025-01" },
    );

    expect(periodId).toBeTruthy();

    // Verify period data
    const period = await t.run(async (ctx) => ctx.db.get(periodId));
    expect(period!.periodStart).toBe("2025-01-01");
    expect(period!.periodEnd).toBe("2025-01-31");
    expect(period!.includedMinutes).toBe(600);
    expect(period!.rolloverMinutes).toBe(0); // no previous months
  });

  it("returns existing period on second call (idempotent)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin);

    const id1 = await asAdmin.mutation(
      api.retainerPeriods.getOrCreateForMonth,
      { projectId, yearMonth: "2025-01" },
    );
    const id2 = await asAdmin.mutation(
      api.retainerPeriods.getOrCreateForMonth,
      { projectId, yearMonth: "2025-01" },
    );

    expect(id1).toBe(id2);
  });

  it("handles different months correctly", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin);

    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-02",
    });

    const period = await t.run(async (ctx) => {
      const periods = await ctx.db
        .query("retainerPeriods")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .collect();
      return periods.find((p) => p.periodStart === "2025-02-01");
    });

    expect(period!.periodEnd).toBe("2025-02-28");
  });

  it("handles December to January year boundary", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin);

    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-12",
    });

    const period = await t.run(async (ctx) => {
      const periods = await ctx.db
        .query("retainerPeriods")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .collect();
      return periods.find((p) => p.periodStart === "2025-12-01");
    });

    expect(period!.periodEnd).toBe("2025-12-31");
  });
});

describe("retainerPeriods — rollover calculation", () => {
  it("computes rollover from unused hours in previous month", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin, 600); // 10 hrs/month

    const taskId = await createTask(t, projectId);

    // January: create period, use only 4 hours (240 min) of 10 hours (600 min)
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-01",
    });
    await addTimeEntry(t, taskId, "2025-01-15", 240);

    // February: rollover should be 600 - 240 = 360 minutes (6 hours)
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-02",
    });

    const febPeriod = await t.run(async (ctx) => {
      const periods = await ctx.db
        .query("retainerPeriods")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .collect();
      return periods.find((p) => p.periodStart === "2025-02-01");
    });

    expect(febPeriod!.rolloverMinutes).toBe(360);
  });

  it("rollover accumulates from up to 3 previous months", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin, 600); // 10 hrs/month

    const taskId = await createTask(t, projectId);

    // January: use 300 min of 600 → 300 unused
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-01",
    });
    await addTimeEntry(t, taskId, "2025-01-15", 300);

    // February: use 200 min of 600 → 400 unused
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-02",
    });
    await addTimeEntry(t, taskId, "2025-02-15", 200);

    // March: use 100 min of 600 → 500 unused
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-03",
    });
    await addTimeEntry(t, taskId, "2025-03-15", 100);

    // April: rollover = Jan unused (300) + Feb unused (400) + Mar unused (500) = 1200
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-04",
    });

    const aprPeriod = await t.run(async (ctx) => {
      const periods = await ctx.db
        .query("retainerPeriods")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .collect();
      return periods.find((p) => p.periodStart === "2025-04-01");
    });

    expect(aprPeriod!.rolloverMinutes).toBe(1200);
  });

  it("rollover hours expire after 3 months", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin, 600);

    const taskId = await createTask(t, projectId);

    // January: use 0 min → 600 unused
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-01",
    });

    // Feb, Mar, Apr: use all 600 each month
    for (const month of ["2025-02", "2025-03", "2025-04"]) {
      await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
        projectId,
        yearMonth: month,
      });
      await addTimeEntry(t, taskId, `${month}-15`, 600);
    }

    // May: January's hours are now >3 months old, should NOT be in rollover
    // Rollover = Feb unused (0) + Mar unused (0) + Apr unused (0) = 0
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-05",
    });

    const mayPeriod = await t.run(async (ctx) => {
      const periods = await ctx.db
        .query("retainerPeriods")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .collect();
      return periods.find((p) => p.periodStart === "2025-05-01");
    });

    expect(mayPeriod!.rolloverMinutes).toBe(0);
  });

  it("rollover is 0 when all hours are used", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin, 600);

    const taskId = await createTask(t, projectId);

    // January: use all 600 minutes
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-01",
    });
    await addTimeEntry(t, taskId, "2025-01-15", 600);

    // February: rollover should be 0
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-02",
    });

    const febPeriod = await t.run(async (ctx) => {
      const periods = await ctx.db
        .query("retainerPeriods")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .collect();
      return periods.find((p) => p.periodStart === "2025-02-01");
    });

    expect(febPeriod!.rolloverMinutes).toBe(0);
  });
});

describe("retainerPeriods.getUsage", () => {
  it("returns correct usage data", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin, 600, 150);

    const taskId = await createTask(t, projectId);

    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-01",
    });
    await addTimeEntry(t, taskId, "2025-01-10", 300); // 5 hours

    const usage = await asAdmin.query(api.retainerPeriods.getUsage, {
      projectId,
      yearMonth: "2025-01",
    });

    expect(usage.includedMinutes).toBe(600);
    expect(usage.rolloverMinutes).toBe(0);
    expect(usage.usedMinutes).toBe(300);
    expect(usage.totalAvailable).toBe(600);
    expect(usage.overageMinutes).toBe(0);
    expect(usage.usagePercent).toBe(50);
    expect(usage.overageRate).toBe(150);
  });

  it("shows 80% usage warning", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin, 600);

    const taskId = await createTask(t, projectId);

    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-01",
    });
    await addTimeEntry(t, taskId, "2025-01-10", 500); // 83%

    const usage = await asAdmin.query(api.retainerPeriods.getUsage, {
      projectId,
      yearMonth: "2025-01",
    });

    expect(usage.usagePercent).toBe(83);
    expect(usage.warnings.usage80).toBe(true);
    expect(usage.warnings.overage).toBe(false);
  });

  it("shows overage warning when exceeding allocation", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin, 600);

    const taskId = await createTask(t, projectId);

    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-01",
    });
    await addTimeEntry(t, taskId, "2025-01-10", 700); // 100 min overage

    const usage = await asAdmin.query(api.retainerPeriods.getUsage, {
      projectId,
      yearMonth: "2025-01",
    });

    expect(usage.overageMinutes).toBe(100);
    expect(usage.warnings.overage).toBe(true);
    // When in overage, usage80 should be false (overage is the more important warning)
    expect(usage.warnings.usage80).toBe(false);
  });

  it("shows expiring hours warning", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin, 600);

    // January: use 0 → 600 unused
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-01",
    });

    // Create Feb, Mar, Apr periods
    for (const month of ["2025-02", "2025-03", "2025-04"]) {
      await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
        projectId,
        yearMonth: month,
      });
    }

    // In April, January's hours are about to expire
    const usage = await asAdmin.query(api.retainerPeriods.getUsage, {
      projectId,
      yearMonth: "2025-04",
    });

    expect(usage.expiringMinutes).toBe(600);
    expect(usage.warnings.expiring).toBe(true);
  });
});

describe("retainerPeriods.getHistory", () => {
  it("returns month-by-month history sorted newest first", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin, 600);

    const taskId = await createTask(t, projectId);

    // Create 3 months
    for (const month of ["2025-01", "2025-02", "2025-03"]) {
      await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
        projectId,
        yearMonth: month,
      });
      await addTimeEntry(t, taskId, `${month}-15`, 300);
    }

    const history = await asAdmin.query(api.retainerPeriods.getHistory, {
      projectId,
    });

    expect(history).toHaveLength(3);
    // Newest first
    expect(history[0].yearMonth).toBe("2025-03");
    expect(history[1].yearMonth).toBe("2025-02");
    expect(history[2].yearMonth).toBe("2025-01");
    // Each month used 300 of 600
    expect(history[0].usedMinutes).toBe(300);
  });
});

describe("retainerPeriods — used always computed from time entries (constraint #24)", () => {
  it("usage reflects time entries added after period creation", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await createRetainerProject(asAdmin, 600);

    const taskId = await createTask(t, projectId);

    // Create period first
    await asAdmin.mutation(api.retainerPeriods.getOrCreateForMonth, {
      projectId,
      yearMonth: "2025-01",
    });

    // Check usage before any entries
    let usage = await asAdmin.query(api.retainerPeriods.getUsage, {
      projectId,
      yearMonth: "2025-01",
    });
    expect(usage.usedMinutes).toBe(0);

    // Add time entry
    await addTimeEntry(t, taskId, "2025-01-15", 120);

    // Usage should now reflect the entry
    usage = await asAdmin.query(api.retainerPeriods.getUsage, {
      projectId,
      yearMonth: "2025-01",
    });
    expect(usage.usedMinutes).toBe(120);

    // Add another entry
    await addTimeEntry(t, taskId, "2025-01-20", 180);

    usage = await asAdmin.query(api.retainerPeriods.getUsage, {
      projectId,
      yearMonth: "2025-01",
    });
    expect(usage.usedMinutes).toBe(300);
  });
});
