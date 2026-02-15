import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

// ── Helper: create a client + project for task tests ──────────────────

async function setupClientProject(asAdmin: any) {
  const clientId = await asAdmin.mutation(api.clients.create, {
    name: "Test Client",
    currency: "USD",
  });
  const projectId = await asAdmin.mutation(api.projects.create, {
    clientId,
    name: "Test Project",
    billingType: "fixed",
  });
  return { clientId, projectId };
}

async function setupSecondMember(t: ReturnType<typeof convexTest>) {
  await t.mutation(internal.users.upsertFromClerk, {
    data: {
      id: "member_2",
      first_name: "Second",
      last_name: "Member",
      email_addresses: [
        { id: "email_2", email_address: "member2@test.com" },
      ],
      primary_email_address_id: "email_2",
      public_metadata: { role: "member" },
    },
  });
  return t.withIdentity({ subject: "member_2" });
}

// ═══════════════════════════════════════════════════════════════════════
// tasks.create
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.create", () => {
  it("creates task with correct defaults (status=inbox, billable=true, assigneeIds=[], isArchived=false)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "My Task",
      projectId,
    });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.title).toBe("My Task");
    expect(task.status).toBe("inbox");
    expect(task.billable).toBe(true);
    expect(task.assigneeIds).toEqual([]);
    expect(task.isArchived).toBe(false);
    expect(task.projectId).toBe(projectId);
  });

  it("creates task with provided fields (title, projectId, assigneeIds)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);

    // Get member user ID
    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Assigned Task",
      projectId,
      assigneeIds: [memberUser!._id],
      status: "today",
    });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.title).toBe("Assigned Task");
    expect(task.status).toBe("today");
    expect(task.assigneeIds).toHaveLength(1);
  });

  it("trims whitespace from title", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "  Trimmed Task  ",
    });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.title).toBe("Trimmed Task");
  });

  it("rejects empty title", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await expect(
      asAdmin.mutation(api.tasks.create, { title: "   " }),
    ).rejects.toThrow("Task title cannot be empty");
  });

  it("creates subtask with parentTaskId, inherits parent's projectId", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    const parentId = await asAdmin.mutation(api.tasks.create, {
      title: "Parent Task",
      projectId,
    });

    const subtaskId = await asAdmin.mutation(api.tasks.create, {
      title: "Subtask",
      parentTaskId: parentId,
    });

    const subtask = await asAdmin.query(api.tasks.get, { id: subtaskId });
    expect(subtask.parentTaskId).toBe(parentId);
    expect(subtask.projectId).toBe(projectId);
  });

  it("rejects subtask if parent doesn't exist", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    // Create and delete a task to get a valid-looking but nonexistent ID
    const tempId = await asAdmin.mutation(api.tasks.create, { title: "Temp" });
    await t.run(async (ctx) => ctx.db.delete(tempId));

    await expect(
      asAdmin.mutation(api.tasks.create, {
        title: "Orphan Subtask",
        parentTaskId: tempId,
      }),
    ).rejects.toThrow("Parent task not found");
  });

  it("rejects subtask of a subtask (no nesting beyond 1 level)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const parentId = await asAdmin.mutation(api.tasks.create, {
      title: "Parent",
    });
    const subtaskId = await asAdmin.mutation(api.tasks.create, {
      title: "Subtask",
      parentTaskId: parentId,
    });

    await expect(
      asAdmin.mutation(api.tasks.create, {
        title: "Nested Subtask",
        parentTaskId: subtaskId,
      }),
    ).rejects.toThrow("Subtasks cannot be nested more than 1 level deep");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.update
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.update", () => {
  it("updates title", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Old Title" });
    await asAdmin.mutation(api.tasks.update, { id: taskId, title: "New Title" });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.title).toBe("New Title");
  });

  it("updates projectId and updates recentProjectIds on user", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });
    await asAdmin.mutation(api.tasks.update, { id: taskId, projectId });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.projectId).toBe(projectId);

    // Check recentProjectIds
    const user = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique(),
    );
    expect(user!.recentProjectIds).toContain(projectId);
  });

  it("updates assigneeIds", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    await asAdmin.mutation(api.tasks.update, {
      id: taskId,
      assigneeIds: [memberUser!._id],
    });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.assigneeIds).toHaveLength(1);
  });

  it("updates workCategoryId", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    // Create work category
    const catId = await t.run(async (ctx) =>
      ctx.db.insert("workCategories", {
        name: "Design",
        isArchived: false,
      }),
    );

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });
    await asAdmin.mutation(api.tasks.update, { id: taskId, workCategoryId: catId });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.workCategoryId).toBe(catId);
    expect(task.workCategoryName).toBe("Design");
  });

  it("updates estimate (integer minutes)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });
    await asAdmin.mutation(api.tasks.update, { id: taskId, estimate: 120 });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.estimate).toBe(120);
  });

  it("updates billable flag", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });
    expect((await asAdmin.query(api.tasks.get, { id: taskId })).billable).toBe(true);

    await asAdmin.mutation(api.tasks.update, { id: taskId, billable: false });
    expect((await asAdmin.query(api.tasks.get, { id: taskId })).billable).toBe(false);
  });

  it("clears optional field when set to null", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const catId = await t.run(async (ctx) =>
      ctx.db.insert("workCategories", { name: "Dev", isArchived: false }),
    );

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });
    await asAdmin.mutation(api.tasks.update, { id: taskId, workCategoryId: catId });
    expect((await asAdmin.query(api.tasks.get, { id: taskId })).workCategoryId).toBe(catId);

    await asAdmin.mutation(api.tasks.update, { id: taskId, workCategoryId: null });
    expect((await asAdmin.query(api.tasks.get, { id: taskId })).workCategoryId).toBeUndefined();
  });

  it("blocks projectId change if time entries exist (constraint #27)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { clientId, projectId } = await setupClientProject(asAdmin);

    const project2Id = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project 2",
      billingType: "t_and_m",
    });

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task with time",
      projectId,
    });

    // Add time entry
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.insert("timeEntries", {
        taskId,
        userId: user!._id,
        date: "2025-06-15",
        durationMinutes: 60,
        method: "manual",
      });
    });

    await expect(
      asAdmin.mutation(api.tasks.update, { id: taskId, projectId: project2Id }),
    ).rejects.toThrow("Cannot change project: task has logged time entries");
  });

  it("admin can update any task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });
    // Admin can update even though no one assigned
    await asAdmin.mutation(api.tasks.update, { id: taskId, title: "Updated" });
    expect((await asAdmin.query(api.tasks.get, { id: taskId })).title).toBe("Updated");
  });

  it("member can update only assigned tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Assigned",
      assigneeIds: [memberUser!._id],
    });

    await asMember.mutation(api.tasks.update, { id: taskId, title: "Updated by member" });
    const task = await asMember.query(api.tasks.get, { id: taskId });
    expect(task.title).toBe("Updated by member");
  });

  it("member cannot update unassigned task (throws)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Not assigned" });

    await expect(
      asMember.mutation(api.tasks.update, { id: taskId, title: "Nope" }),
    ).rejects.toThrow("Access denied");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.updateStatus
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.updateStatus", () => {
  it("admin can set any status including done", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });
    await asAdmin.mutation(api.tasks.updateStatus, { id: taskId, status: "done" });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.status).toBe("done");
  });

  it("member can set inbox, today, next_up, admin_review, stuck", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task",
      assigneeIds: [memberUser!._id],
    });

    for (const status of ["inbox", "today", "next_up", "admin_review", "stuck"] as const) {
      await asMember.mutation(api.tasks.updateStatus, { id: taskId, status });
      const task = await asMember.query(api.tasks.get, { id: taskId });
      expect(task.status).toBe(status);
    }
  });

  it("member cannot set done (throws Admin access required)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task",
      assigneeIds: [memberUser!._id],
    });

    await expect(
      asMember.mutation(api.tasks.updateStatus, { id: taskId, status: "done" }),
    ).rejects.toThrow("Admin access required");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.list
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.list", () => {
  it("returns tasks with enrichment (project name, client name, assignees, etc.)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    await asAdmin.mutation(api.tasks.create, {
      title: "Enriched Task",
      projectId,
    });

    const result = await asAdmin.query(api.tasks.list, {});
    expect(result.page).toHaveLength(1);
    expect(result.page[0].title).toBe("Enriched Task");
    expect(result.page[0].projectName).toBe("Test Project");
    expect(result.page[0].clientName).toBe("Test Client");
    expect(result.page[0].totalMinutes).toBe(0);
    expect(result.page[0].subtaskCount).toBe(0);
    expect(result.page[0].commentCount).toBe(0);
    expect(result.page[0].hasDescription).toBe(false);
  });

  it("excludes subtasks (parentTaskId != null) from results", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const parentId = await asAdmin.mutation(api.tasks.create, { title: "Parent" });
    await asAdmin.mutation(api.tasks.create, {
      title: "Subtask",
      parentTaskId: parentId,
    });

    const result = await asAdmin.query(api.tasks.list, {});
    expect(result.page).toHaveLength(1);
    expect(result.page[0].title).toBe("Parent");
  });

  it("excludes archived tasks by default", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.tasks.create, { title: "Active Task" });
    const archivedId = await asAdmin.mutation(api.tasks.create, { title: "Archived Task" });
    await asAdmin.mutation(api.tasks.archive, { id: archivedId });

    const result = await asAdmin.query(api.tasks.list, {});
    expect(result.page).toHaveLength(1);
    expect(result.page[0].title).toBe("Active Task");
  });

  it("includes archived when includeArchived=true", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.tasks.create, { title: "Active Task" });
    const archivedId = await asAdmin.mutation(api.tasks.create, { title: "Archived Task" });
    await asAdmin.mutation(api.tasks.archive, { id: archivedId });

    const result = await asAdmin.query(api.tasks.list, { includeArchived: true });
    expect(result.page).toHaveLength(2);
  });

  it("admin sees all tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    await setupMember(t);

    await asAdmin.mutation(api.tasks.create, { title: "Task 1" });
    await asAdmin.mutation(api.tasks.create, { title: "Task 2" });

    const result = await asAdmin.query(api.tasks.list, {});
    expect(result.page).toHaveLength(2);
  });

  it("member sees only tasks where they are in assigneeIds", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    await asAdmin.mutation(api.tasks.create, { title: "Unassigned" });
    await asAdmin.mutation(api.tasks.create, {
      title: "Assigned to member",
      assigneeIds: [memberUser!._id],
    });

    const result = await asMember.query(api.tasks.list, {});
    expect(result.page).toHaveLength(1);
    expect(result.page[0].title).toBe("Assigned to member");
  });

  it("filters by projectId", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { clientId, projectId } = await setupClientProject(asAdmin);

    const project2Id = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project 2",
      billingType: "t_and_m",
    });

    await asAdmin.mutation(api.tasks.create, { title: "Task P1", projectId });
    await asAdmin.mutation(api.tasks.create, { title: "Task P2", projectId: project2Id });

    const result = await asAdmin.query(api.tasks.list, {
      filters: { projectId },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].title).toBe("Task P1");
  });

  it("filters by clientId (via project lookup)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { clientId, projectId } = await setupClientProject(asAdmin);

    const client2Id = await asAdmin.mutation(api.clients.create, {
      name: "Client 2",
      currency: "EUR",
    });
    const project2Id = await asAdmin.mutation(api.projects.create, {
      clientId: client2Id,
      name: "Project 2",
      billingType: "fixed",
    });

    await asAdmin.mutation(api.tasks.create, { title: "Task C1", projectId });
    await asAdmin.mutation(api.tasks.create, { title: "Task C2", projectId: project2Id });

    const result = await asAdmin.query(api.tasks.list, {
      filters: { clientId },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].title).toBe("Task C1");
  });

  it("filters by assigneeId", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    await setupMember(t);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );
    const adminUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique(),
    );

    await asAdmin.mutation(api.tasks.create, {
      title: "Assigned to member",
      assigneeIds: [memberUser!._id],
    });
    await asAdmin.mutation(api.tasks.create, {
      title: "Assigned to admin",
      assigneeIds: [adminUser!._id],
    });

    const result = await asAdmin.query(api.tasks.list, {
      filters: { assigneeId: memberUser!._id },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].title).toBe("Assigned to member");
  });

  it("filters by status", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.tasks.create, { title: "Inbox Task" });
    const todayId = await asAdmin.mutation(api.tasks.create, { title: "Today Task" });
    await asAdmin.mutation(api.tasks.updateStatus, { id: todayId, status: "today" });

    const result = await asAdmin.query(api.tasks.list, {
      filters: { status: "today" },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].title).toBe("Today Task");
  });

  it("combines multiple filters with AND logic", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    await setupMember(t);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    await asAdmin.mutation(api.tasks.create, {
      title: "Match",
      projectId,
      assigneeIds: [memberUser!._id],
    });
    await asAdmin.mutation(api.tasks.create, {
      title: "Only project",
      projectId,
    });
    await asAdmin.mutation(api.tasks.create, {
      title: "Only assignee",
      assigneeIds: [memberUser!._id],
    });

    const result = await asAdmin.query(api.tasks.list, {
      filters: { projectId, assigneeId: memberUser!._id },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].title).toBe("Match");
  });

  it("returns empty array when no tasks match", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const result = await asAdmin.query(api.tasks.list, {
      filters: { status: "done" },
    });
    expect(result.page).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.getAutoAssignSuggestion
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.getAutoAssignSuggestion", () => {
  it("returns suggested user when project has default assignee for category", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    const catId = await t.run(async (ctx) =>
      ctx.db.insert("workCategories", { name: "Design", isArchived: false }),
    );

    // Set default assignee on project
    await asAdmin.mutation(api.projects.setDefaultAssignees, {
      projectId,
      defaultAssignees: [{ workCategoryId: catId, userId: memberUser!._id }],
    });

    const suggestion = await asAdmin.query(api.tasks.getAutoAssignSuggestion, {
      projectId,
      workCategoryId: catId,
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion!.suggestedUserId).toBe(memberUser!._id);
    expect(suggestion!.userName).toBe("Team Member");
  });

  it("returns null when no default assignee configured", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    const catId = await t.run(async (ctx) =>
      ctx.db.insert("workCategories", { name: "Dev", isArchived: false }),
    );

    const suggestion = await asAdmin.query(api.tasks.getAutoAssignSuggestion, {
      projectId,
      workCategoryId: catId,
    });

    expect(suggestion).toBeNull();
  });

  it("returns null when project has no defaultAssignees", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    const catId = await t.run(async (ctx) =>
      ctx.db.insert("workCategories", { name: "Testing", isArchived: false }),
    );

    const suggestion = await asAdmin.query(api.tasks.getAutoAssignSuggestion, {
      projectId,
      workCategoryId: catId,
    });

    expect(suggestion).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.duplicate
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.duplicate", () => {
  it("copies title, description, assigneeIds, projectId, estimate, workCategoryId, billable", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    const catId = await t.run(async (ctx) =>
      ctx.db.insert("workCategories", { name: "Design", isArchived: false }),
    );

    const adminUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique(),
    );

    const originalId = await asAdmin.mutation(api.tasks.create, {
      title: "Original",
      projectId,
      assigneeIds: [adminUser!._id],
    });

    // Set additional fields
    await asAdmin.mutation(api.tasks.update, {
      id: originalId,
      workCategoryId: catId,
      estimate: 120,
      billable: false,
    });

    // Add description directly
    await t.run(async (ctx) => {
      await ctx.db.patch(originalId, {
        description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test desc" }] }] },
      });
    });

    const dupId = await asAdmin.mutation(api.tasks.duplicate, { id: originalId });
    const dup = await asAdmin.query(api.tasks.get, { id: dupId });

    expect(dup.title).toBe("Original");
    expect(dup.projectId).toBe(projectId);
    expect(dup.assigneeIds).toHaveLength(1);
    expect(dup.workCategoryId).toBe(catId);
    expect(dup.estimate).toBe(120);
    expect(dup.billable).toBe(false);
    // description is copied (check raw record since get doesn't return hasDescription)
    const dupRaw = await t.run(async (ctx) => ctx.db.get(dupId));
    expect(dupRaw!.description).toBeDefined();
  });

  it("sets status to inbox", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const originalId = await asAdmin.mutation(api.tasks.create, { title: "Task" });
    await asAdmin.mutation(api.tasks.updateStatus, { id: originalId, status: "done" });

    const dupId = await asAdmin.mutation(api.tasks.duplicate, { id: originalId });
    const dup = await asAdmin.query(api.tasks.get, { id: dupId });
    expect(dup.status).toBe("inbox");
  });

  it("sets isArchived to false", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const originalId = await asAdmin.mutation(api.tasks.create, { title: "Task" });
    await asAdmin.mutation(api.tasks.archive, { id: originalId });

    // Duplicate the archived task
    const dupId = await asAdmin.mutation(api.tasks.duplicate, { id: originalId });
    const dup = await asAdmin.query(api.tasks.get, { id: dupId });
    expect(dup.isArchived).toBe(false);
  });

  it("does NOT copy parentTaskId (duplicate is always top-level)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const parentId = await asAdmin.mutation(api.tasks.create, { title: "Parent" });
    const subtaskId = await asAdmin.mutation(api.tasks.create, {
      title: "Subtask",
      parentTaskId: parentId,
    });

    const dupId = await asAdmin.mutation(api.tasks.duplicate, { id: subtaskId });
    const dup = await asAdmin.query(api.tasks.get, { id: dupId });
    expect(dup.parentTaskId).toBeUndefined();
  });

  it("member can duplicate only assigned tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Not assigned" });

    await expect(
      asMember.mutation(api.tasks.duplicate, { id: taskId }),
    ).rejects.toThrow("Access denied");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.archive
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.archive", () => {
  it("sets isArchived=true on task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });
    await asAdmin.mutation(api.tasks.archive, { id: taskId });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.isArchived).toBe(true);
  });

  it("cascades to subtasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const parentId = await asAdmin.mutation(api.tasks.create, { title: "Parent" });
    const subtaskId = await asAdmin.mutation(api.tasks.create, {
      title: "Subtask",
      parentTaskId: parentId,
    });

    await asAdmin.mutation(api.tasks.archive, { id: parentId });

    const subtask = await t.run(async (ctx) => ctx.db.get(subtaskId));
    expect(subtask!.isArchived).toBe(true);
  });

  it("auto-stops running timer on task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Timed Task",
      projectId,
    });

    // Start timer
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, {
        timerTaskId: taskId,
        timerStartedAt: Date.now() - 3 * 60 * 1000, // 3 min ago
      });
    });

    await asAdmin.mutation(api.tasks.archive, { id: taskId });

    // Timer should be stopped
    const user = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique(),
    );
    expect(user!.timerTaskId).toBeUndefined();
    expect(user!.timerStartedAt).toBeUndefined();

    // Time entry should be created
    const entries = await t.run(async (ctx) => ctx.db.query("timeEntries").collect());
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].method).toBe("timer");
  });

  it("member can archive only assigned tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Unassigned" });

    await expect(
      asMember.mutation(api.tasks.archive, { id: taskId }),
    ).rejects.toThrow("Access denied");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.remove
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.remove", () => {
  it("deletes task and related records (subtasks, comments, attachments, activity log)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "To Delete" });

    // Create a subtask
    const subtaskId = await asAdmin.mutation(api.tasks.create, {
      title: "Subtask",
      parentTaskId: taskId,
    });

    // Add comment and activity log directly
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.insert("comments", {
        taskId,
        userId: user!._id,
        content: { type: "doc", content: [] },
        mentionedUserIds: [],
      });
      await ctx.db.insert("activityLogEntries", {
        taskId,
        action: "created",
        userId: user!._id,
      });
    });

    await asAdmin.mutation(api.tasks.remove, { id: taskId });

    // All should be deleted
    const task = await t.run(async (ctx) => ctx.db.get(taskId));
    expect(task).toBeNull();

    const subtask = await t.run(async (ctx) => ctx.db.get(subtaskId));
    expect(subtask).toBeNull();

    const comments = await t.run(async (ctx) => ctx.db.query("comments").collect());
    expect(comments).toHaveLength(0);

    const logs = await t.run(async (ctx) => ctx.db.query("activityLogEntries").collect());
    expect(logs).toHaveLength(0);
  });

  it("blocked if time entries exist (throws)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Has time",
      projectId,
    });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.insert("timeEntries", {
        taskId,
        userId: user!._id,
        date: "2025-06-15",
        durationMinutes: 30,
        method: "manual",
      });
    });

    await expect(
      asAdmin.mutation(api.tasks.remove, { id: taskId }),
    ).rejects.toThrow("Cannot delete task: time entries exist");
  });

  it("admin only (member throws)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task",
      assigneeIds: [memberUser!._id],
    });

    await expect(
      asMember.mutation(api.tasks.remove, { id: taskId }),
    ).rejects.toThrow("Admin access required");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.moveToProject
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.moveToProject", () => {
  it("changes projectId on task and clears workCategoryId", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { clientId, projectId } = await setupClientProject(asAdmin);

    const project2Id = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project 2",
      billingType: "t_and_m",
    });

    const catId = await t.run(async (ctx) =>
      ctx.db.insert("workCategories", { name: "Design", isArchived: false }),
    );

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task",
      projectId,
    });
    await asAdmin.mutation(api.tasks.update, { id: taskId, workCategoryId: catId });

    await asAdmin.mutation(api.tasks.moveToProject, { id: taskId, projectId: project2Id });

    const task = await asAdmin.query(api.tasks.get, { id: taskId });
    expect(task.projectId).toBe(project2Id);
    expect(task.workCategoryId).toBeUndefined();
  });

  it("cascades to subtasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { clientId, projectId } = await setupClientProject(asAdmin);

    const project2Id = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project 2",
      billingType: "fixed",
    });

    const parentId = await asAdmin.mutation(api.tasks.create, {
      title: "Parent",
      projectId,
    });
    const subtaskId = await asAdmin.mutation(api.tasks.create, {
      title: "Subtask",
      parentTaskId: parentId,
    });

    await asAdmin.mutation(api.tasks.moveToProject, { id: parentId, projectId: project2Id });

    const subtask = await t.run(async (ctx) => ctx.db.get(subtaskId));
    expect(subtask!.projectId).toBe(project2Id);
  });

  it("blocked if time entries exist (throws with explanation)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { clientId, projectId } = await setupClientProject(asAdmin);

    const project2Id = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project 2",
      billingType: "fixed",
    });

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task with time",
      projectId,
    });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.insert("timeEntries", {
        taskId,
        userId: user!._id,
        date: "2025-06-15",
        durationMinutes: 60,
        method: "manual",
      });
    });

    await expect(
      asAdmin.mutation(api.tasks.moveToProject, { id: taskId, projectId: project2Id }),
    ).rejects.toThrow("Cannot move task: time entries exist");
  });

  it("admin only", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { clientId, projectId } = await setupClientProject(asAdmin);

    const project2Id = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project 2",
      billingType: "fixed",
    });

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task",
      projectId,
      assigneeIds: [memberUser!._id],
    });

    await expect(
      asMember.mutation(api.tasks.moveToProject, { id: taskId, projectId: project2Id }),
    ).rejects.toThrow("Admin access required");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.bulkUpdateStatus
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.bulkUpdateStatus", () => {
  it("updates status on multiple tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const id1 = await asAdmin.mutation(api.tasks.create, { title: "Task 1" });
    const id2 = await asAdmin.mutation(api.tasks.create, { title: "Task 2" });

    const result = await asAdmin.mutation(api.tasks.bulkUpdateStatus, {
      ids: [id1, id2],
      status: "today",
    });

    expect(result.updated).toBe(2);
    expect((await asAdmin.query(api.tasks.get, { id: id1 })).status).toBe("today");
    expect((await asAdmin.query(api.tasks.get, { id: id2 })).status).toBe("today");
  });

  it("rejects > 50 tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const ids: any[] = [];
    for (let i = 0; i < 51; i++) {
      ids.push(await asAdmin.mutation(api.tasks.create, { title: `Task ${i}` }));
    }

    await expect(
      asAdmin.mutation(api.tasks.bulkUpdateStatus, { ids, status: "today" }),
    ).rejects.toThrow("Maximum 50 tasks per bulk action");
  });

  it("member cannot bulk-set done", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task",
      assigneeIds: [memberUser!._id],
    });

    await expect(
      asMember.mutation(api.tasks.bulkUpdateStatus, { ids: [taskId], status: "done" }),
    ).rejects.toThrow("Admin access required");
  });

  it("skips tasks member cannot access (returns count of actually updated)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    const assignedId = await asAdmin.mutation(api.tasks.create, {
      title: "Assigned",
      assigneeIds: [memberUser!._id],
    });
    const unassignedId = await asAdmin.mutation(api.tasks.create, {
      title: "Unassigned",
    });

    const result = await asMember.mutation(api.tasks.bulkUpdateStatus, {
      ids: [assignedId, unassignedId],
      status: "today",
    });

    expect(result.updated).toBe(1);
    // Assigned task updated
    const assigned = await t.run(async (ctx) => ctx.db.get(assignedId));
    expect(assigned!.status).toBe("today");
    // Unassigned task NOT updated
    const unassigned = await t.run(async (ctx) => ctx.db.get(unassignedId));
    expect(unassigned!.status).toBe("inbox");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.bulkUpdateAssignees
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.bulkUpdateAssignees", () => {
  it("updates assigneeIds on multiple tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    await setupMember(t);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    const id1 = await asAdmin.mutation(api.tasks.create, { title: "Task 1" });
    const id2 = await asAdmin.mutation(api.tasks.create, { title: "Task 2" });

    const result = await asAdmin.mutation(api.tasks.bulkUpdateAssignees, {
      ids: [id1, id2],
      assigneeIds: [memberUser!._id],
    });

    expect(result.updated).toBe(2);
  });

  it("caps at 50", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const ids: any[] = [];
    for (let i = 0; i < 51; i++) {
      ids.push(await asAdmin.mutation(api.tasks.create, { title: `Task ${i}` }));
    }

    await expect(
      asAdmin.mutation(api.tasks.bulkUpdateAssignees, { ids, assigneeIds: [] }),
    ).rejects.toThrow("Maximum 50 tasks per bulk action");
  });

  it("member can only update assigned tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique(),
    );

    const assignedId = await asAdmin.mutation(api.tasks.create, {
      title: "Assigned",
      assigneeIds: [memberUser!._id],
    });
    const unassignedId = await asAdmin.mutation(api.tasks.create, {
      title: "Unassigned",
    });

    const result = await asMember.mutation(api.tasks.bulkUpdateAssignees, {
      ids: [assignedId, unassignedId],
      assigneeIds: [memberUser!._id],
    });

    expect(result.updated).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.bulkArchive
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.bulkArchive", () => {
  it("archives multiple tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const id1 = await asAdmin.mutation(api.tasks.create, { title: "Task 1" });
    const id2 = await asAdmin.mutation(api.tasks.create, { title: "Task 2" });

    const result = await asAdmin.mutation(api.tasks.bulkArchive, {
      ids: [id1, id2],
    });

    expect(result.archived).toBe(2);
    const t1 = await t.run(async (ctx) => ctx.db.get(id1));
    const t2 = await t.run(async (ctx) => ctx.db.get(id2));
    expect(t1!.isArchived).toBe(true);
    expect(t2!.isArchived).toBe(true);
  });

  it("cascades subtask archive per task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const parentId = await asAdmin.mutation(api.tasks.create, { title: "Parent" });
    const subtaskId = await asAdmin.mutation(api.tasks.create, {
      title: "Subtask",
      parentTaskId: parentId,
    });

    await asAdmin.mutation(api.tasks.bulkArchive, { ids: [parentId] });

    const subtask = await t.run(async (ctx) => ctx.db.get(subtaskId));
    expect(subtask!.isArchived).toBe(true);
  });

  it("auto-stops timers", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Timed",
      projectId,
    });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, {
        timerTaskId: taskId,
        timerStartedAt: Date.now() - 2 * 60 * 1000,
      });
    });

    await asAdmin.mutation(api.tasks.bulkArchive, { ids: [taskId] });

    const user = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique(),
    );
    expect(user!.timerTaskId).toBeUndefined();
  });

  it("caps at 50", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const ids: any[] = [];
    for (let i = 0; i < 51; i++) {
      ids.push(await asAdmin.mutation(api.tasks.create, { title: `Task ${i}` }));
    }

    await expect(
      asAdmin.mutation(api.tasks.bulkArchive, { ids }),
    ).rejects.toThrow("Maximum 50 tasks per bulk action");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// users.listAll
// ═══════════════════════════════════════════════════════════════════════

describe("users.listAll", () => {
  it("returns all non-anonymized users", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    await setupMember(t);

    const users = await asAdmin.query(api.users.listAll, {});
    expect(users).toHaveLength(2);
    expect(users.map((u: any) => u.name).sort()).toEqual(["Admin User", "Team Member"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// users.updateRecentProjects
// ═══════════════════════════════════════════════════════════════════════

describe("users.updateRecentProjects", () => {
  it("adds projectId to front of recentProjectIds", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);

    await asAdmin.mutation(api.users.updateRecentProjects, { projectId });

    const user = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique(),
    );
    expect(user!.recentProjectIds![0]).toBe(projectId);
  });

  it("deduplicates (if already in list, moves to front)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { clientId, projectId } = await setupClientProject(asAdmin);

    const project2Id = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project 2",
      billingType: "fixed",
    });

    await asAdmin.mutation(api.users.updateRecentProjects, { projectId });
    await asAdmin.mutation(api.users.updateRecentProjects, { projectId: project2Id });
    await asAdmin.mutation(api.users.updateRecentProjects, { projectId }); // move back to front

    const user = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique(),
    );
    expect(user!.recentProjectIds![0]).toBe(projectId);
    expect(user!.recentProjectIds![1]).toBe(project2Id);
    expect(user!.recentProjectIds).toHaveLength(2);
  });

  it("caps at 5 entries", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const clientId = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });

    const projectIds = [];
    for (let i = 0; i < 7; i++) {
      const pid = await asAdmin.mutation(api.projects.create, {
        clientId,
        name: `Project ${i}`,
        billingType: "fixed",
      });
      projectIds.push(pid);
      await asAdmin.mutation(api.users.updateRecentProjects, { projectId: pid });
    }

    const user = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique(),
    );
    expect(user!.recentProjectIds).toHaveLength(5);
    // Most recent should be first
    expect(user!.recentProjectIds![0]).toBe(projectIds[6]);
  });

  it("creates array if recentProjectIds is undefined", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    // Verify it starts undefined
    const userBefore = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique(),
    );
    expect(userBefore!.recentProjectIds).toBeUndefined();

    const clientId = await asAdmin.mutation(api.clients.create, {
      name: "Client",
      currency: "USD",
    });
    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project",
      billingType: "fixed",
    });

    await asAdmin.mutation(api.users.updateRecentProjects, { projectId });

    const userAfter = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique(),
    );
    expect(userAfter!.recentProjectIds).toHaveLength(1);
  });
});
