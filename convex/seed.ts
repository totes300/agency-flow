import { internalMutation } from "./_generated/server";

/**
 * Clear all seeded data (clients, projects, tasks, comments, time entries, etc.)
 * Run via: npx convex run --no-push seed:clearAll
 */
export const clearAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "comments", "timeEntries", "attachments", "activityLogEntries",
      "retainerPeriods", "projectCategoryEstimates", "tasks", "projects", "clients",
    ] as const;
    let total = 0;
    for (const table of tables) {
      const rows = await ctx.db.query(table as any).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      total += rows.length;
    }
    return { deleted: total };
  },
});

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

    const taskIds: any[] = [];
    for (const t of taskDefs) {
      const id = await ctx.db.insert("tasks", {
        title: t.title,
        projectId: t.projectId,
        status: t.status,
        assigneeIds: t.assignSelf && assignee ? [assignee._id] : [],
        workCategoryId: t.catName ? catByName(t.catName) : undefined,
        billable: true,
        isArchived: false,
      });
      taskIds.push(id);
    }

    // ── Descriptions (on a few tasks) ──────────────────────────────
    // Tiptap JSON format — simple paragraph nodes
    const makeDesc = (text: string) => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });

    await ctx.db.patch(taskIds[0], {
      description: makeDesc(
        "Create a high-fidelity mockup for the homepage following the approved wireframes. Key sections: hero banner, feature grid, testimonials carousel, and footer with newsletter signup. Use the brand color palette and Figma component library.",
      ),
    });
    await ctx.db.patch(taskIds[1], {
      description: makeDesc(
        "Build the responsive layout using CSS Grid + Flexbox. Must support desktop (1440px), tablet (768px), and mobile (375px) breakpoints. Reference the Figma responsive specs.",
      ),
    });
    await ctx.db.patch(taskIds[8], {
      description: makeDesc(
        "Implement OAuth 2.0 + JWT authentication flow with Clerk. Includes sign-up, sign-in, password reset, and session management. Follow the security checklist in Notion.",
      ),
    });

    // ── Comments (on a few tasks) ──────────────────────────────────
    if (assignee) {
      await ctx.db.insert("comments", {
        taskId: taskIds[0],
        userId: assignee._id,
        content: makeDesc("Updated the layout based on client feedback from yesterday's call. Moving the CTA above the fold."),
        mentionedUserIds: [],
      });
      await ctx.db.insert("comments", {
        taskId: taskIds[0],
        userId: assignee._id,
        content: makeDesc("Added the revised color scheme. Ready for review."),
        mentionedUserIds: [],
      });
      await ctx.db.insert("comments", {
        taskId: taskIds[0],
        userId: assignee._id,
        content: makeDesc("Client approved the final version. Moving to development."),
        mentionedUserIds: [],
      });
      await ctx.db.insert("comments", {
        taskId: taskIds[8],
        userId: assignee._id,
        content: makeDesc("Started implementing the Clerk integration. JWT template is set up."),
        mentionedUserIds: [],
      });
    }

    // ── Subtasks (on "Design homepage mockup" and "Implement auth flow") ──
    const subtaskDefs = [
      { parentId: taskIds[0], title: "Create wireframe sketch", status: "done" as const },
      { parentId: taskIds[0], title: "Design hero section", status: "done" as const },
      { parentId: taskIds[0], title: "Design feature grid", status: "today" as const },
      { parentId: taskIds[0], title: "Design testimonials section", status: "inbox" as const },
      { parentId: taskIds[0], title: "Design footer", status: "inbox" as const },
      { parentId: taskIds[8], title: "Set up Clerk provider", status: "done" as const },
      { parentId: taskIds[8], title: "Implement sign-in page", status: "done" as const },
      { parentId: taskIds[8], title: "Implement sign-up page", status: "today" as const },
      { parentId: taskIds[8], title: "Add session management", status: "inbox" as const },
    ];

    for (const st of subtaskDefs) {
      const parentTask = await ctx.db.get(st.parentId);
      await ctx.db.insert("tasks", {
        title: st.title,
        parentTaskId: st.parentId,
        projectId: parentTask!.projectId,
        status: st.status,
        assigneeIds: assignee ? [assignee._id] : [],
        billable: true,
        isArchived: false,
      });
    }

    return { clients: 2, projects: 3, tasks: taskDefs.length, subtasks: subtaskDefs.length };
  },
});
