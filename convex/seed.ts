import { internalMutation } from "./_generated/server";

/**
 * Seed test data: 2 clients, 3 projects, ~12 tasks with varied statuses/categories.
 * Run via: npx convex run --no-push seed:seedTestData
 * Safe to run multiple times — skips if clients already exist.
 */
export const seedTestData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Skip if test clients already exist
    const existingClients = await ctx.db.query("clients").collect();
    if (existingClients.some((c) => c.name === "Acme Corp")) {
      throw new Error("Test data already seeded (Acme Corp exists).");
    }

    // Find or create the first user to assign tasks to
    const users = await ctx.db.query("users").collect();
    const assignee = users[0]; // may be undefined if no user yet

    // Ensure work categories exist
    let categories = await ctx.db.query("workCategories").collect();
    if (categories.length === 0) {
      const names = ["Design", "Development", "Copywriting", "PM", "Testing"];
      for (const name of names) {
        await ctx.db.insert("workCategories", { name, isArchived: false });
      }
      categories = await ctx.db.query("workCategories").collect();
    }

    const catByName = (name: string) =>
      categories.find((c) => c.name === name)?._id;

    // ── Clients ──────────────────────────────────────────────────
    const acmeId = await ctx.db.insert("clients", {
      name: "Acme Corp",
      contactName: "Jane Smith",
      contactEmail: "jane@acme.com",
      currency: "EUR",
      isArchived: false,
    });

    const bigcoId = await ctx.db.insert("clients", {
      name: "BigCo Inc",
      contactName: "Bob Johnson",
      contactEmail: "bob@bigco.com",
      currency: "USD",
      isArchived: false,
    });

    // ── Projects ─────────────────────────────────────────────────
    const websiteId = await ctx.db.insert("projects", {
      clientId: acmeId,
      name: "Website Redesign",
      billingType: "retainer",
      isArchived: false,
      retainerStatus: "active",
      includedHoursPerMonth: 2400,
      overageRate: 120,
      startDate: "2026-01-01",
    });

    const brandId = await ctx.db.insert("projects", {
      clientId: acmeId,
      name: "Brand Guide",
      billingType: "fixed",
      isArchived: false,
    });

    const appId = await ctx.db.insert("projects", {
      clientId: bigcoId,
      name: "Mobile App",
      billingType: "t_and_m",
      isArchived: false,
      hourlyRate: 150,
    });

    // ── Tasks ────────────────────────────────────────────────────
    const taskDefs: {
      title: string;
      projectId: typeof websiteId;
      status: "inbox" | "today" | "next_up" | "admin_review" | "stuck" | "done";
      catName?: string;
      assignSelf?: boolean;
    }[] = [
      { title: "Design homepage mockup", projectId: websiteId, status: "today", catName: "Design", assignSelf: true },
      { title: "Build responsive layout", projectId: websiteId, status: "next_up", catName: "Development", assignSelf: true },
      { title: "Write hero section copy", projectId: websiteId, status: "inbox", catName: "Copywriting" },
      { title: "Review client feedback", projectId: websiteId, status: "admin_review", catName: "PM", assignSelf: true },
      { title: "Create brand color palette", projectId: brandId, status: "today", catName: "Design", assignSelf: true },
      { title: "Design logo variations", projectId: brandId, status: "stuck", catName: "Design" },
      { title: "Write brand voice guidelines", projectId: brandId, status: "inbox", catName: "Copywriting" },
      { title: "Set up React Native project", projectId: appId, status: "done", catName: "Development", assignSelf: true },
      { title: "Implement auth flow", projectId: appId, status: "today", catName: "Development", assignSelf: true },
      { title: "Design app onboarding screens", projectId: appId, status: "next_up", catName: "Design" },
      { title: "Write API integration tests", projectId: appId, status: "inbox", catName: "Testing" },
      { title: "Project kickoff meeting notes", projectId: appId, status: "done", catName: "PM", assignSelf: true },
    ];

    for (const t of taskDefs) {
      await ctx.db.insert("tasks", {
        title: t.title,
        projectId: t.projectId,
        status: t.status,
        assigneeIds: t.assignSelf && assignee ? [assignee._id] : [],
        workCategoryId: t.catName ? catByName(t.catName) : undefined,
        billable: true,
        isArchived: false,
      });
    }

    return { clients: 2, projects: 3, tasks: taskDefs.length };
  },
});
