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

describe("comments.create", () => {
  it("inserts correctly", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };
    const id = await asAdmin.mutation(api.comments.create, { taskId, content, mentionedUserIds: [] });

    const result = await asAdmin.query(api.comments.list, { taskId });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].userName).toBe("Admin User");
  });

  it("writes notification for mentions", async () => {
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

    const content = { type: "doc", content: [] };
    await asAdmin.mutation(api.comments.create, {
      taskId, content, mentionedUserIds: [memberUser!._id],
    });

    const notifications = await t.run(async (ctx) =>
      ctx.db.query("notifications").withIndex("by_userId", (q) => q.eq("userId", memberUser!._id)).collect()
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("mention");
    expect(notifications[0].isRead).toBe(false);
  });

  it("no self-mention notification", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const adminUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique()
    );

    await asAdmin.mutation(api.comments.create, {
      taskId, content: { type: "doc", content: [] }, mentionedUserIds: [adminUser!._id],
    });

    const notifications = await t.run(async (ctx) => ctx.db.query("notifications").collect());
    expect(notifications).toHaveLength(0);
  });
});

describe("comments.list", () => {
  it("newest first, paginated", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await asAdmin.mutation(api.comments.create, {
      taskId, content: { text: "first" }, mentionedUserIds: [],
    });
    await asAdmin.mutation(api.comments.create, {
      taskId, content: { text: "second" }, mentionedUserIds: [],
    });

    const result = await asAdmin.query(api.comments.list, { taskId });
    expect(result.page).toHaveLength(2);
    // Newest first — second was created after first
    expect(result.page[0].content).toEqual({ text: "second" });
  });
});

describe("comments.remove", () => {
  it("author deletes own", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const id = await asAdmin.mutation(api.comments.create, {
      taskId, content: { type: "doc", content: [] }, mentionedUserIds: [],
    });
    await asAdmin.mutation(api.comments.remove, { id });
    const result = await asAdmin.query(api.comments.list, { taskId });
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

    const id = await asMember.mutation(api.comments.create, {
      taskId, content: { type: "doc", content: [] }, mentionedUserIds: [],
    });

    // Admin can delete member's comment
    await asAdmin.mutation(api.comments.remove, { id });
    const result = await asAdmin.query(api.comments.list, { taskId });
    expect(result.page).toHaveLength(0);
  });

  it("other member blocked", async () => {
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

    // Admin creates comment
    const id = await asAdmin.mutation(api.comments.create, {
      taskId, content: { type: "doc", content: [] }, mentionedUserIds: [],
    });

    // Member can't delete admin's comment
    await expect(asMember.mutation(api.comments.remove, { id })).rejects.toThrow("Access denied");
  });
});
