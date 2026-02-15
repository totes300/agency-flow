import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentUser } from "./lib/permissions";

/**
 * Global search across tasks, clients, and projects.
 * Uses simple string matching — sufficient for <1000 records per PRD.
 * Role-aware: team members only see tasks assigned to them (constraint #26).
 */
export const globalSearch = query({
  args: { query: v.string() },
  handler: async (ctx, { query: searchQuery }) => {
    const user = await getCurrentUser(ctx);
    if (!user) return { tasks: [], clients: [], projects: [] };

    const q = searchQuery.toLowerCase();
    const isAdmin = user.role === "admin";

    // Search tasks
    const allTasks = await ctx.db.query("tasks").collect();
    const matchingTasks = allTasks
      .filter((t) => {
        if (t.isArchived) return false;
        // Team members only see assigned tasks (constraint #26)
        if (!isAdmin && !t.assigneeIds.includes(user._id)) return false;
        return t.title.toLowerCase().includes(q);
      })
      .slice(0, 5);

    // Enrich tasks with project name
    const tasksWithProject = await Promise.all(
      matchingTasks.map(async (task) => {
        let projectName: string | undefined;
        if (task.projectId) {
          const project = await ctx.db.get(task.projectId);
          projectName = project?.name;
        }
        return {
          _id: task._id,
          title: task.title,
          projectName,
        };
      }),
    );

    // Search clients (admin only per constraint — team members don't manage clients)
    let matchingClients: { _id: string; name: string }[] = [];
    if (isAdmin) {
      const allClients = await ctx.db.query("clients").collect();
      matchingClients = allClients
        .filter((c) => !c.isArchived && c.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map((c) => ({ _id: c._id, name: c.name }));
    }

    // Search projects
    const allProjects = await ctx.db.query("projects").collect();
    const matchingProjects = allProjects
      .filter((p) => !p.isArchived && p.name.toLowerCase().includes(q))
      .slice(0, 5);

    const projectsWithClient = await Promise.all(
      matchingProjects.map(async (project) => {
        const client = await ctx.db.get(project.clientId);
        return {
          _id: project._id,
          name: project.name,
          clientName: client?.name,
        };
      }),
    );

    return {
      tasks: tasksWithProject,
      clients: matchingClients,
      projects: projectsWithClient,
    };
  },
});
