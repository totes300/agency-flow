import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

describe("activityLog.log", () => {
  it("creates entry with correct fields", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });

    const adminUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique()
    );

    await t.mutation(internal.activityLog.log, {
      taskId,
      userId: adminUser!._id,
      action: "test action",
      metadata: { key: "value" },
    });

    const result = await asAdmin.query(api.activityLog.list, { taskId });
    // tasks.create also logs "created task", so we expect 2 entries
    expect(result.page).toHaveLength(2);
    // Newest first — "test action" was logged after "created task"
    expect(result.page[0].action).toBe("test action");
    expect(result.page[0].metadata).toEqual({ key: "value" });
    expect(result.page[0].userName).toBe("Admin User");
  });
});

describe("activityLog.list", () => {
  it("newest first, paginated", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });

    const adminUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique()
    );

    await t.mutation(internal.activityLog.log, { taskId, userId: adminUser!._id, action: "first" });
    await t.mutation(internal.activityLog.log, { taskId, userId: adminUser!._id, action: "second" });

    const result = await asAdmin.query(api.activityLog.list, { taskId });
    // tasks.create also logs "created task", so 3 entries total
    expect(result.page).toHaveLength(3);
    expect(result.page[0].action).toBe("second");
    expect(result.page[1].action).toBe("first");
  });

  it("member scoped to assigned tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Unassigned Task" });

    await expect(
      asMember.query(api.activityLog.list, { taskId }),
    ).rejects.toThrow("Access denied");
  });
});
