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

describe("attachments.create", () => {
  it("inserts with uploadedBy", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    // We can't easily test with real storage in convex-test, so insert a fake storageId
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    const id = await asAdmin.mutation(api.attachments.create, {
      taskId, storageId, fileName: "test.pdf", mimeType: "application/pdf", size: 1000,
    });

    const list = await asAdmin.query(api.attachments.list, { taskId });
    expect(list).toHaveLength(1);
    expect(list[0].fileName).toBe("test.pdf");
    expect(list[0].uploaderName).toBe("Admin User");
  });

  it("rejects >10MB", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    await expect(
      asAdmin.mutation(api.attachments.create, {
        taskId, storageId, fileName: "big.pdf", mimeType: "application/pdf", size: 11 * 1024 * 1024,
      }),
    ).rejects.toThrow("File exceeds 10 MB limit");
  });

  it("rejects disallowed MIME", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    await expect(
      asAdmin.mutation(api.attachments.create, {
        taskId, storageId, fileName: "evil.exe", mimeType: "application/x-executable", size: 1000,
      }),
    ).rejects.toThrow("File type not allowed");
  });

  it("rejects 21st file", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    // Insert 20 attachments directly
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      const sid = await ctx.storage.store(new Blob(["x"]));
      for (let i = 0; i < 20; i++) {
        await ctx.db.insert("attachments", {
          taskId, storageId: sid, fileName: `file${i}.pdf`, mimeType: "application/pdf", size: 100, uploadedBy: user!._id,
        });
      }
    });

    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));
    await expect(
      asAdmin.mutation(api.attachments.create, {
        taskId, storageId, fileName: "21st.pdf", mimeType: "application/pdf", size: 100,
      }),
    ).rejects.toThrow("Maximum 20 files per task");
  });
});

describe("attachments.list", () => {
  it("returns with uploader name", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    await asAdmin.mutation(api.attachments.create, {
      taskId, storageId, fileName: "doc.pdf", mimeType: "application/pdf", size: 500,
    });

    const list = await asAdmin.query(api.attachments.list, { taskId });
    expect(list).toHaveLength(1);
    expect(list[0].uploaderName).toBe("Admin User");
    expect(list[0].url).toBeTruthy();
  });
});

describe("attachments.remove", () => {
  it("uploader deletes own", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    const id = await asAdmin.mutation(api.attachments.create, {
      taskId, storageId, fileName: "doc.pdf", mimeType: "application/pdf", size: 500,
    });

    await asAdmin.mutation(api.attachments.remove, { id });
    const list = await asAdmin.query(api.attachments.list, { taskId });
    expect(list).toHaveLength(0);
  });

  it("admin deletes any; member blocked", async () => {
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
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    // Admin uploads
    const id = await asAdmin.mutation(api.attachments.create, {
      taskId, storageId, fileName: "admin.pdf", mimeType: "application/pdf", size: 500,
    });

    // Member can't delete admin's file
    await expect(asMember.mutation(api.attachments.remove, { id })).rejects.toThrow("Access denied");

    // Admin can delete
    await asAdmin.mutation(api.attachments.remove, { id });
    const list = await asAdmin.query(api.attachments.list, { taskId });
    expect(list).toHaveLength(0);
  });
});
