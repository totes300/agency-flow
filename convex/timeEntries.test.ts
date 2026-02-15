import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

async function setupClientProject(asAdmin: any) {
  const clientId = await asAdmin.mutation(api.clients.create, { name: "Test Client", currency: "USD" });
  const projectId = await asAdmin.mutation(api.projects.create, { clientId, name: "Test Project", billingType: "fixed" });
  return { clientId, projectId };
}

describe("timeEntries.create", () => {
  it("creates with correct fields, method=manual", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const entryId = await asAdmin.mutation(api.timeEntries.create, {
      taskId, durationMinutes: 60, date: "2025-06-15",
    });

    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].durationMinutes).toBe(60);
    expect(result.page[0].method).toBe("manual");
  });

  it("blocked on task without project", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "No Project Task" });

    await expect(
      asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" }),
    ).rejects.toThrow("Task must have a project");
  });

  it("member logs on assigned task", async () => {
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

    await asMember.mutation(api.timeEntries.create, { taskId, durationMinutes: 45, date: "2025-06-15" });
    const result = await asMember.query(api.timeEntries.list, { taskId });
    expect(result.page).toHaveLength(1);
  });

  it("member blocked on unassigned task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await expect(
      asMember.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" }),
    ).rejects.toThrow("Access denied");
  });
});

describe("timeEntries.list", () => {
  it("newest first, paginated", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-14" });
    await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 60, date: "2025-06-15" });

    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page).toHaveLength(2);
    expect(result.page[0].durationMinutes).toBe(60);
    expect(result.page[1].durationMinutes).toBe(30);
  });
});

describe("timeEntries.update", () => {
  it("owner edits own", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const entryId = await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await asAdmin.mutation(api.timeEntries.update, { id: entryId, durationMinutes: 45 });

    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page[0].durationMinutes).toBe(45);
  });

  it("admin edits any", async () => {
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
    const entryId = await asMember.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await asAdmin.mutation(api.timeEntries.update, { id: entryId, durationMinutes: 60 });
    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page[0].durationMinutes).toBe(60);
  });

  it("member blocked on others'", async () => {
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
    const entryId = await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await expect(
      asMember.mutation(api.timeEntries.update, { id: entryId, durationMinutes: 60 }),
    ).rejects.toThrow("Access denied");
  });
});

describe("timeEntries.remove", () => {
  it("owner deletes own", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const entryId = await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await asAdmin.mutation(api.timeEntries.remove, { id: entryId });
    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page).toHaveLength(0);
  });

  it("admin deletes any", async () => {
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
    const entryId = await asMember.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await asAdmin.mutation(api.timeEntries.remove, { id: entryId });
    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page).toHaveLength(0);
  });

  it("member blocked on others'", async () => {
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
    const entryId = await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await expect(
      asMember.mutation(api.timeEntries.remove, { id: entryId }),
    ).rejects.toThrow("Access denied");
  });
});
