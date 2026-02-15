import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

describe("clients.create", () => {
  it("creates a client with all fields", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const id = await asAdmin.mutation(api.clients.create, {
      name: "Acme Corp",
      contactName: "John Doe",
      contactEmail: "john@acme.com",
      currency: "eur",
    });

    const client = await asAdmin.query(api.clients.get, { id });
    expect(client.name).toBe("Acme Corp");
    expect(client.contactName).toBe("John Doe");
    expect(client.contactEmail).toBe("john@acme.com");
    expect(client.currency).toBe("EUR"); // uppercased
    expect(client.isArchived).toBe(false);
  });

  it("trims whitespace from name", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const id = await asAdmin.mutation(api.clients.create, {
      name: "  Acme Corp  ",
      currency: "USD",
    });
    const client = await asAdmin.query(api.clients.get, { id });
    expect(client.name).toBe("Acme Corp");
  });

  it("rejects empty name", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await expect(
      asAdmin.mutation(api.clients.create, { name: "  ", currency: "USD" }),
    ).rejects.toThrow("Client name cannot be empty");
  });

  it("rejects non-admin", async () => {
    const t = convexTest(schema, modules);
    const asMember = await setupMember(t);

    await expect(
      asMember.mutation(api.clients.create, { name: "Test", currency: "USD" }),
    ).rejects.toThrow("Admin access required");
  });
});

describe("clients.update", () => {
  it("updates client fields", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const id = await asAdmin.mutation(api.clients.create, {
      name: "Acme Corp",
      currency: "USD",
    });

    await asAdmin.mutation(api.clients.update, {
      id,
      name: "Acme Inc",
      contactName: "Jane Doe",
      contactEmail: "jane@acme.com",
    });

    const client = await asAdmin.query(api.clients.get, { id });
    expect(client.name).toBe("Acme Inc");
    expect(client.contactName).toBe("Jane Doe");
    expect(client.contactEmail).toBe("jane@acme.com");
  });
});

describe("clients.update — currency locking (constraint #15)", () => {
  it("allows currency change when no projects exist", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const id = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });

    await asAdmin.mutation(api.clients.update, {
      id,
      currency: "EUR",
    });

    const client = await asAdmin.query(api.clients.get, { id });
    expect(client.currency).toBe("EUR");
  });

  it("blocks currency change when projects exist", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const clientId = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });

    // Create a project under this client
    await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project 1",
      billingType: "fixed",
    });

    await expect(
      asAdmin.mutation(api.clients.update, {
        id: clientId,
        currency: "EUR",
      }),
    ).rejects.toThrow("Currency cannot be changed after projects have been created");
  });

  it("allows updating same currency when projects exist", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const clientId = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });

    await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project 1",
      billingType: "fixed",
    });

    // Same currency should not throw
    await asAdmin.mutation(api.clients.update, {
      id: clientId,
      currency: "USD",
    });
  });

  it("isCurrencyLocked returns correct status", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const clientId = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });

    const lockedBefore = await asAdmin.query(api.clients.isCurrencyLocked, {
      id: clientId,
    });
    expect(lockedBefore).toBe(false);

    await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project",
      billingType: "t_and_m",
    });

    const lockedAfter = await asAdmin.query(api.clients.isCurrencyLocked, {
      id: clientId,
    });
    expect(lockedAfter).toBe(true);
  });
});

describe("clients.archive — cascading (UC-2.1)", () => {
  it("archives client and cascades to projects and tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const clientId = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project",
      billingType: "fixed",
    });

    // Create a task under the project (using run to directly insert)
    await t.run(async (ctx) => {
      await ctx.db.insert("tasks", {
        projectId,
        title: "Test Task",
        status: "inbox",
        assigneeIds: [],
        billable: true,
        isArchived: false,
      });
    });

    await asAdmin.mutation(api.clients.archive, { id: clientId });

    // Verify cascade
    const client = await asAdmin.query(api.clients.get, { id: clientId });
    expect(client.isArchived).toBe(true);

    const project = await t.run(async (ctx) => ctx.db.get(projectId));
    expect(project!.isArchived).toBe(true);

    const tasks = await t.run(async (ctx) =>
      ctx.db.query("tasks").withIndex("by_projectId", (q) => q.eq("projectId", projectId)).collect(),
    );
    expect(tasks[0].isArchived).toBe(true);
  });

  it("auto-stops running timers on archived client's tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const clientId = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project",
      billingType: "fixed",
    });

    // Create a task and set up a running timer
    let taskId: string;
    let userId: string;
    await t.run(async (ctx) => {
      const task = await ctx.db.insert("tasks", {
        projectId,
        title: "Timed Task",
        status: "today",
        assigneeIds: [],
        billable: true,
        isArchived: false,
      });
      taskId = task;

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1"))
        .unique();
      userId = user!._id;

      // Start timer 5 minutes ago
      await ctx.db.patch(user!._id, {
        timerTaskId: task,
        timerStartedAt: Date.now() - 5 * 60 * 1000,
      });
    });

    await asAdmin.mutation(api.clients.archive, { id: clientId });

    // Verify timer was stopped
    const user = await t.run(async (ctx) =>
      ctx.db.query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1"))
        .unique(),
    );
    expect(user!.timerTaskId).toBeUndefined();
    expect(user!.timerStartedAt).toBeUndefined();

    // Verify time entry was created
    const timeEntries = await t.run(async (ctx) =>
      ctx.db.query("timeEntries").collect(),
    );
    expect(timeEntries.length).toBeGreaterThanOrEqual(1);
    expect(timeEntries[0].method).toBe("timer");
    expect(timeEntries[0].durationMinutes).toBeGreaterThanOrEqual(5);
  });

  it("is idempotent (archiving already archived client)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const clientId = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });

    await asAdmin.mutation(api.clients.archive, { id: clientId });
    // Should not throw
    await asAdmin.mutation(api.clients.archive, { id: clientId });
  });
});

describe("clients.unarchive", () => {
  it("unarchives a client", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const clientId = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });

    await asAdmin.mutation(api.clients.archive, { id: clientId });
    await asAdmin.mutation(api.clients.unarchive, { id: clientId });

    const client = await asAdmin.query(api.clients.get, { id: clientId });
    expect(client.isArchived).toBe(false);
  });
});

describe("clients.remove", () => {
  it("deletes a client with no time entries", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const clientId = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project",
      billingType: "fixed",
    });

    // Add a task (no time entries)
    await t.run(async (ctx) => {
      await ctx.db.insert("tasks", {
        projectId,
        title: "Task",
        status: "inbox",
        assigneeIds: [],
        billable: true,
        isArchived: false,
      });
    });

    await asAdmin.mutation(api.clients.remove, { id: clientId });

    // Verify everything is deleted
    const client = await t.run(async (ctx) => ctx.db.get(clientId));
    expect(client).toBeNull();

    const project = await t.run(async (ctx) => ctx.db.get(projectId));
    expect(project).toBeNull();

    const tasks = await t.run(async (ctx) => ctx.db.query("tasks").collect());
    expect(tasks).toHaveLength(0);
  });

  it("blocks delete when time entries exist", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const clientId = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project",
      billingType: "fixed",
    });

    await t.run(async (ctx) => {
      const taskId = await ctx.db.insert("tasks", {
        projectId,
        title: "Task",
        status: "inbox",
        assigneeIds: [],
        billable: true,
        isArchived: false,
      });

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1"))
        .unique();

      await ctx.db.insert("timeEntries", {
        taskId,
        userId: user!._id,
        date: "2025-01-15",
        durationMinutes: 60,
        method: "manual",
      });
    });

    await expect(
      asAdmin.mutation(api.clients.remove, { id: clientId }),
    ).rejects.toThrow("Cannot delete client: projects have logged time entries");
  });
});

describe("clients.list", () => {
  it("lists active clients by default", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.clients.create, {
      name: "Active Client",
      currency: "USD",
    });
    const archivedId = await asAdmin.mutation(api.clients.create, {
      name: "Archived Client",
      currency: "EUR",
    });
    await asAdmin.mutation(api.clients.archive, { id: archivedId });

    const clients = await asAdmin.query(api.clients.list, {});
    expect(clients).toHaveLength(1);
    expect(clients[0].name).toBe("Active Client");
  });

  it("includes archived clients when flag is set", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.clients.create, {
      name: "Active Client",
      currency: "USD",
    });
    const archivedId = await asAdmin.mutation(api.clients.create, {
      name: "Archived Client",
      currency: "EUR",
    });
    await asAdmin.mutation(api.clients.archive, { id: archivedId });

    const clients = await asAdmin.query(api.clients.list, {
      includeArchived: true,
    });
    expect(clients).toHaveLength(2);
  });

  it("rejects non-admin", async () => {
    const t = convexTest(schema, modules);
    const asMember = await setupMember(t);

    await expect(
      asMember.query(api.clients.list, {}),
    ).rejects.toThrow("Admin access required");
  });
});
