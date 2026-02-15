import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

async function createClient(asAdmin: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>) {
  return await asAdmin.mutation(api.clients.create, {
    name: "Test Client",
    currency: "USD",
  });
}

describe("projects.create — Fixed", () => {
  it("creates a fixed project", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Website Redesign",
      billingType: "fixed",
    });

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.name).toBe("Website Redesign");
    expect(project.billingType).toBe("fixed");
    expect(project.isArchived).toBe(false);
    expect(project.clientName).toBe("Test Client");
    expect(project.clientCurrency).toBe("USD");
  });

  it("rejects empty name", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    await expect(
      asAdmin.mutation(api.projects.create, {
        clientId,
        name: "  ",
        billingType: "fixed",
      }),
    ).rejects.toThrow("Project name cannot be empty");
  });

  it("rejects non-admin", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const clientId = await createClient(asAdmin);

    await expect(
      asMember.mutation(api.projects.create, {
        clientId,
        name: "Project",
        billingType: "fixed",
      }),
    ).rejects.toThrow("Admin access required");
  });
});

describe("projects.create — Retainer", () => {
  it("creates a retainer project with correct fields", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Monthly Retainer",
      billingType: "retainer",
      includedHoursPerMonth: 600, // 10 hours in minutes
      overageRate: 150,
    });

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.billingType).toBe("retainer");
    expect(project.retainerStatus).toBe("active");
    expect(project.includedHoursPerMonth).toBe(600);
    expect(project.overageRate).toBe(150);
    expect(project.startDate).toBeDefined();
  });

  it("rejects retainer without included hours", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    await expect(
      asAdmin.mutation(api.projects.create, {
        clientId,
        name: "Bad Retainer",
        billingType: "retainer",
      }),
    ).rejects.toThrow("Retainer projects require included hours per month");
  });
});

describe("projects.create — T&M", () => {
  it("creates a T&M project with flat rate", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Consulting",
      billingType: "t_and_m",
      hourlyRate: 100,
    });

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.billingType).toBe("t_and_m");
    expect(project.hourlyRate).toBe(100);
  });

  it("creates a T&M project with per-category rates", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    // Create work categories
    await asAdmin.mutation(api.workCategories.seed, {});
    const categories = await asAdmin.query(api.workCategories.list, {});
    const designCat = categories.find((c) => c.name === "Design")!;
    const devCat = categories.find((c) => c.name === "Development")!;

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Agency Work",
      billingType: "t_and_m",
      tmCategoryRates: [
        { workCategoryId: designCat._id, rate: 120 },
        { workCategoryId: devCat._id, rate: 150 },
      ],
    });

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.tmCategoryRates).toHaveLength(2);
  });
});

describe("projects.setCategoryEstimates", () => {
  it("sets category estimates for a fixed project", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    await asAdmin.mutation(api.workCategories.seed, {});
    const categories = await asAdmin.query(api.workCategories.list, {});
    const designCat = categories.find((c) => c.name === "Design")!;
    const devCat = categories.find((c) => c.name === "Development")!;

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Fixed Project",
      billingType: "fixed",
    });

    await asAdmin.mutation(api.projects.setCategoryEstimates, {
      projectId,
      estimates: [
        {
          workCategoryId: designCat._id,
          estimatedMinutes: 1200, // 20 hours
          internalCostRate: 80,
          clientBillingRate: 120,
        },
        {
          workCategoryId: devCat._id,
          estimatedMinutes: 2400, // 40 hours
          internalCostRate: 100,
          clientBillingRate: 150,
        },
      ],
    });

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.categoryEstimates).toHaveLength(2);
    expect(project.categoryEstimates[0].estimatedMinutes).toBe(1200);
    expect(project.categoryEstimates[0].workCategoryName).toBe("Design");
    expect(project.categoryEstimates[1].estimatedMinutes).toBe(2400);
  });

  it("replaces existing estimates on update", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    await asAdmin.mutation(api.workCategories.seed, {});
    const categories = await asAdmin.query(api.workCategories.list, {});
    const designCat = categories.find((c) => c.name === "Design")!;

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Fixed Project",
      billingType: "fixed",
    });

    // First set
    await asAdmin.mutation(api.projects.setCategoryEstimates, {
      projectId,
      estimates: [
        { workCategoryId: designCat._id, estimatedMinutes: 600 },
      ],
    });

    // Replace with new set
    await asAdmin.mutation(api.projects.setCategoryEstimates, {
      projectId,
      estimates: [
        { workCategoryId: designCat._id, estimatedMinutes: 1200 },
      ],
    });

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.categoryEstimates).toHaveLength(1);
    expect(project.categoryEstimates[0].estimatedMinutes).toBe(1200);
  });

  it("rejects estimates on non-fixed project", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Retainer",
      billingType: "retainer",
      includedHoursPerMonth: 600,
    });

    await expect(
      asAdmin.mutation(api.projects.setCategoryEstimates, {
        projectId,
        estimates: [],
      }),
    ).rejects.toThrow("Category estimates are only for Fixed projects");
  });
});

describe("projects.setDefaultAssignees (UC-2.5)", () => {
  it("sets default assignees per work category", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    await setupMember(t);
    const clientId = await createClient(asAdmin);

    await asAdmin.mutation(api.workCategories.seed, {});
    const categories = await asAdmin.query(api.workCategories.list, {});
    const designCat = categories.find((c) => c.name === "Design")!;

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project",
      billingType: "fixed",
    });

    // Get user IDs
    const users = await asAdmin.query(api.users.listAll, {});
    const member = users.find((u) => u.role === "member")!;

    await asAdmin.mutation(api.projects.setDefaultAssignees, {
      projectId,
      defaultAssignees: [
        { workCategoryId: designCat._id, userId: member._id },
      ],
    });

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.defaultAssignees).toHaveLength(1);
    expect(project.defaultAssignees![0].workCategoryId).toBe(designCat._id);
    expect(project.defaultAssignees![0].userId).toBe(member._id);
  });
});

describe("projects.toggleRetainerStatus (UC-2.7)", () => {
  it("toggles retainer status between active and inactive", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Retainer",
      billingType: "retainer",
      includedHoursPerMonth: 600,
    });

    // Initially active
    let project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.retainerStatus).toBe("active");

    // Toggle to inactive
    await asAdmin.mutation(api.projects.toggleRetainerStatus, { id: projectId });
    project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.retainerStatus).toBe("inactive");

    // Toggle back to active
    await asAdmin.mutation(api.projects.toggleRetainerStatus, { id: projectId });
    project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.retainerStatus).toBe("active");
  });

  it("rejects toggle on non-retainer", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Fixed",
      billingType: "fixed",
    });

    await expect(
      asAdmin.mutation(api.projects.toggleRetainerStatus, { id: projectId }),
    ).rejects.toThrow("Only retainer projects have active/inactive status");
  });
});

describe("projects.archive", () => {
  it("archives project and cascades to tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project",
      billingType: "fixed",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("tasks", {
        projectId,
        title: "Task 1",
        status: "inbox",
        assigneeIds: [],
        billable: true,
        isArchived: false,
      });
    });

    await asAdmin.mutation(api.projects.archive, { id: projectId });

    const project = await asAdmin.query(api.projects.get, { id: projectId });
    expect(project.isArchived).toBe(true);

    const tasks = await t.run(async (ctx) =>
      ctx.db.query("tasks").withIndex("by_projectId", (q) => q.eq("projectId", projectId)).collect(),
    );
    expect(tasks[0].isArchived).toBe(true);
  });
});

describe("projects.listByClient", () => {
  it("lists active projects for a client", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const clientId = await createClient(asAdmin);

    await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Active Project",
      billingType: "fixed",
    });

    const archivedId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Archived Project",
      billingType: "t_and_m",
    });
    await asAdmin.mutation(api.projects.archive, { id: archivedId });

    const projects = await asAdmin.query(api.projects.listByClient, {
      clientId,
    });
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Active Project");
  });
});

describe("projects — member access", () => {
  it("member can view project details but not billing data", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const clientId = await createClient(asAdmin);

    await asAdmin.mutation(api.workCategories.seed, {});
    const categories = await asAdmin.query(api.workCategories.list, {});
    const designCat = categories.find((c) => c.name === "Design")!;

    const projectId = await asAdmin.mutation(api.projects.create, {
      clientId,
      name: "Project",
      billingType: "fixed",
    });

    await asAdmin.mutation(api.projects.setCategoryEstimates, {
      projectId,
      estimates: [
        {
          workCategoryId: designCat._id,
          estimatedMinutes: 1200,
          internalCostRate: 80,
          clientBillingRate: 120,
        },
      ],
    });

    const project = await asMember.query(api.projects.get, { id: projectId });
    expect(project.name).toBe("Project");
    // Members should NOT see category estimates (contains billing data)
    expect(project.categoryEstimates).toHaveLength(0);
  });
});
