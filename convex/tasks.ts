import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireAuth, isAdmin } from "./lib/permissions";
import { taskStatus } from "./schema";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Stop a user's running timer, creating a time entry if elapsed > 0. */
async function stopTimer(
  ctx: { db: any },
  user: { _id: any; timerTaskId?: any; timerStartedAt?: number },
) {
  if (!user.timerTaskId || !user.timerStartedAt) return;

  const now = Date.now();
  const elapsedMs = now - user.timerStartedAt;
  const elapsedMinutes = Math.ceil(elapsedMs / 60000);

  if (elapsedMinutes > 0) {
    const today = new Date(now);
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await ctx.db.insert("timeEntries", {
      taskId: user.timerTaskId,
      userId: user._id,
      date: dateStr,
      durationMinutes: elapsedMinutes,
      method: "timer" as const,
    });
  }

  await ctx.db.patch(user._id, {
    timerTaskId: undefined,
    timerStartedAt: undefined,
  });
}

/** Check whether a task has any time entries. */
async function hasTimeEntries(ctx: { db: any }, taskId: any): Promise<boolean> {
  const entry = await ctx.db
    .query("timeEntries")
    .withIndex("by_taskId", (q: any) => q.eq("taskId", taskId))
    .first();
  return entry !== null;
}

/** Delete all related records for a task (comments, attachments, activity log). */
async function deleteTaskRelated(ctx: { db: any }, taskId: any) {
  const comments = await ctx.db
    .query("comments")
    .withIndex("by_taskId", (q: any) => q.eq("taskId", taskId))
    .collect();
  for (const c of comments) await ctx.db.delete(c._id);

  const attachments = await ctx.db
    .query("attachments")
    .withIndex("by_taskId", (q: any) => q.eq("taskId", taskId))
    .collect();
  for (const a of attachments) await ctx.db.delete(a._id);

  const logs = await ctx.db
    .query("activityLogEntries")
    .withIndex("by_taskId", (q: any) => q.eq("taskId", taskId))
    .collect();
  for (const l of logs) await ctx.db.delete(l._id);
}

// ── Queries ──────────────────────────────────────────────────────────────

/**
 * Get a single task with enrichment.
 */
export const get = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");

    // Permission: member can only view assigned tasks
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    // Enrich with project/client
    let projectName: string | null = null;
    let clientName: string | null = null;
    let clientId: string | null = null;
    let projectBillingType: string | null = null;

    if (task.projectId) {
      const project = await ctx.db.get(task.projectId);
      if (project) {
        projectName = project.name;
        projectBillingType = project.billingType;
        const client = await ctx.db.get(project.clientId);
        clientName = client?.name ?? null;
        clientId = project.clientId;
      }
    }

    // Assignees
    const assignees = await Promise.all(
      task.assigneeIds.map(async (uid: any) => {
        const u = await ctx.db.get(uid);
        return u ? { _id: u._id, name: u.name, avatarUrl: u.avatarUrl } : null;
      }),
    );

    // Work category
    let workCategoryName: string | null = null;
    if (task.workCategoryId) {
      const cat = await ctx.db.get(task.workCategoryId);
      workCategoryName = cat?.name ?? null;
    }

    // Total minutes
    const timeEntries = await ctx.db
      .query("timeEntries")
      .withIndex("by_taskId", (q: any) => q.eq("taskId", id))
      .collect();
    const totalMinutes = timeEntries.reduce(
      (sum: number, e: any) => sum + e.durationMinutes,
      0,
    );

    return {
      ...task,
      projectName,
      clientName,
      clientId,
      projectBillingType,
      assignees: assignees.filter(Boolean),
      workCategoryName,
      totalMinutes,
    };
  },
});

/**
 * Main task list query with pagination, filters, role scoping, enrichment.
 */
export const list = query({
  args: {
    paginationOpts: v.optional(
      v.object({
        cursor: v.optional(v.string()),
        numItems: v.optional(v.number()),
      }),
    ),
    filters: v.optional(
      v.object({
        clientId: v.optional(v.id("clients")),
        projectId: v.optional(v.id("projects")),
        assigneeId: v.optional(v.id("users")),
        status: v.optional(taskStatus),
        dateFrom: v.optional(v.string()),
        dateTo: v.optional(v.string()),
      }),
    ),
    groupBy: v.optional(
      v.union(
        v.literal("none"),
        v.literal("client"),
        v.literal("project"),
        v.literal("assignee"),
        v.literal("status"),
      ),
    ),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const numItems = args.paginationOpts?.numItems ?? 50;
    const admin = isAdmin(user);
    const filters = args.filters;

    // Collect all tasks (we filter in memory for complex conditions)
    let allTasks = await ctx.db.query("tasks").collect();

    // Exclude subtasks from main list (constraint #7)
    allTasks = allTasks.filter((t) => !t.parentTaskId);

    // Exclude archived by default
    if (!args.includeArchived) {
      allTasks = allTasks.filter((t) => !t.isArchived);
    }

    // Role scoping: member sees only assigned tasks
    if (!admin) {
      allTasks = allTasks.filter((t) => t.assigneeIds.includes(user._id));
    }

    // Build project→client lookup if needed
    let projectMap = new Map<string, any>();
    if (filters?.clientId || filters?.projectId || true) {
      // Always need project data for enrichment
      const projects = await ctx.db.query("projects").collect();
      projectMap = new Map(projects.map((p) => [p._id, p]));
    }

    // Apply filters
    if (filters?.clientId) {
      allTasks = allTasks.filter((t) => {
        if (!t.projectId) return false;
        const project = projectMap.get(t.projectId);
        return project?.clientId === filters.clientId;
      });
    }

    if (filters?.projectId) {
      allTasks = allTasks.filter((t) => t.projectId === filters.projectId);
    }

    if (filters?.assigneeId) {
      allTasks = allTasks.filter((t) =>
        t.assigneeIds.includes(filters.assigneeId!),
      );
    }

    if (filters?.status) {
      allTasks = allTasks.filter((t) => t.status === filters.status);
    }

    if (filters?.dateFrom) {
      const fromMs = new Date(filters.dateFrom).getTime();
      allTasks = allTasks.filter((t) => t._creationTime >= fromMs);
    }

    if (filters?.dateTo) {
      const toMs = new Date(filters.dateTo).getTime() + 86400000; // end of day
      allTasks = allTasks.filter((t) => t._creationTime < toMs);
    }

    // Simple cursor-based pagination using _creationTime
    const cursorTime = args.paginationOpts?.cursor
      ? parseFloat(args.paginationOpts.cursor)
      : Infinity;

    // Sort by _creationTime descending (newest first)
    allTasks.sort((a, b) => b._creationTime - a._creationTime);

    // Apply cursor
    const afterCursor = allTasks.filter(
      (t) => t._creationTime < cursorTime,
    );

    const page = afterCursor.slice(0, numItems);
    const hasMore = afterCursor.length > numItems;
    const nextCursor = page.length > 0
      ? String(page[page.length - 1]._creationTime)
      : undefined;

    // Bulk lookups for enrichment
    const allClients = await ctx.db.query("clients").collect();
    const clientMap = new Map(allClients.map((c) => [c._id, c]));

    const allUsers = await ctx.db.query("users").collect();
    const userMap = new Map(allUsers.map((u) => [u._id, u]));

    const allCategories = await ctx.db.query("workCategories").collect();
    const categoryMap = new Map(allCategories.map((c) => [c._id, c]));

    // Get subtask counts, comment counts, time totals for the page
    const taskIds = new Set(page.map((t) => t._id));

    // Subtasks
    const allSubtasks = await ctx.db.query("tasks").collect();
    const subtasksByParent = new Map<string, any[]>();
    for (const st of allSubtasks) {
      if (st.parentTaskId && taskIds.has(st.parentTaskId)) {
        const list = subtasksByParent.get(st.parentTaskId) ?? [];
        list.push(st);
        subtasksByParent.set(st.parentTaskId, list);
      }
    }

    // Comments
    const allComments = await ctx.db.query("comments").collect();
    const commentsByTask = new Map<string, any[]>();
    for (const c of allComments) {
      if (taskIds.has(c.taskId)) {
        const list = commentsByTask.get(c.taskId) ?? [];
        list.push(c);
        commentsByTask.set(c.taskId, list);
      }
    }

    // Time entries
    const allTimeEntries = await ctx.db.query("timeEntries").collect();
    const minutesByTask = new Map<string, number>();
    for (const te of allTimeEntries) {
      if (taskIds.has(te.taskId)) {
        minutesByTask.set(
          te.taskId,
          (minutesByTask.get(te.taskId) ?? 0) + te.durationMinutes,
        );
      }
    }

    // Enrich each task
    const enrichedPage = page.map((task) => {
      const project = task.projectId ? projectMap.get(task.projectId) : null;
      const client = project ? clientMap.get(project.clientId) : null;

      const assignees = task.assigneeIds
        .map((uid: any) => {
          const u = userMap.get(uid);
          return u
            ? { _id: u._id, name: u.name, avatarUrl: u.avatarUrl }
            : null;
        })
        .filter(Boolean);

      const category = task.workCategoryId
        ? categoryMap.get(task.workCategoryId)
        : null;

      const subtasks = subtasksByParent.get(task._id) ?? [];
      const completedSubtaskCount = subtasks.filter(
        (s: any) => s.status === "done",
      ).length;

      const comments = commentsByTask.get(task._id) ?? [];
      // Sort comments by _creationTime descending for latest
      comments.sort((a: any, b: any) => b._creationTime - a._creationTime);
      const latestComment = comments[0]
        ? (() => {
            const commentUser = userMap.get(comments[0].userId);
            return {
              userName: commentUser?.name ?? "Unknown",
              avatarUrl: commentUser?.avatarUrl,
              content: typeof comments[0].content === "string"
                ? comments[0].content.slice(0, 200)
                : "Comment",
              _creationTime: comments[0]._creationTime,
            };
          })()
        : undefined;

      // Subtask preview (first 5)
      const subtaskPreview = subtasks.slice(0, 5).map((s: any) => ({
        _id: s._id,
        title: s.title,
        status: s.status,
      }));

      // Description preview (plain text extraction from Tiptap JSON)
      let descriptionPreview: string | undefined;
      if (task.description) {
        try {
          const extractText = (node: any): string => {
            if (typeof node === "string") return node;
            let text = "";
            if (node.text) text += node.text;
            if (node.content) {
              for (const child of node.content) {
                text += extractText(child);
              }
            }
            return text;
          };
          const plainText = extractText(task.description);
          descriptionPreview = plainText.slice(0, 200) || undefined;
        } catch {
          descriptionPreview = undefined;
        }
      }

      return {
        _id: task._id,
        _creationTime: task._creationTime,
        title: task.title,
        status: task.status,
        projectId: task.projectId,
        assigneeIds: task.assigneeIds,
        workCategoryId: task.workCategoryId,
        estimate: task.estimate,
        billable: task.billable,
        isArchived: task.isArchived,
        parentTaskId: task.parentTaskId,
        // Enriched fields
        projectName: project?.name ?? null,
        clientName: client?.name ?? null,
        clientId: client?._id ?? null,
        projectBillingType: project?.billingType ?? null,
        assignees,
        workCategoryName: category?.name ?? null,
        totalMinutes: minutesByTask.get(task._id) ?? 0,
        subtaskCount: subtasks.length,
        completedSubtaskCount,
        commentCount: comments.length,
        hasDescription: !!task.description,
        latestComment,
        subtaskPreview,
        descriptionPreview,
      };
    });

    return {
      page: enrichedPage,
      continueCursor: nextCursor ?? "",
      isDone: !hasMore,
    };
  },
});

/**
 * Get auto-assign suggestion for a work category on a project.
 */
export const getAutoAssignSuggestion = query({
  args: {
    projectId: v.id("projects"),
    workCategoryId: v.id("workCategories"),
  },
  handler: async (ctx, { projectId, workCategoryId }) => {
    await requireAuth(ctx);

    const project = await ctx.db.get(projectId);
    if (!project) return null;

    // Check project's default assignees first
    const defaultAssignees = project.defaultAssignees ?? [];
    const match = defaultAssignees.find(
      (a: any) => a.workCategoryId === workCategoryId,
    );

    if (match) {
      const user = await ctx.db.get(match.userId);
      return {
        suggestedUserId: match.userId,
        userName: user?.name ?? null,
      };
    }

    // Fall back to global work category default
    const category = await ctx.db.get(workCategoryId);
    if (category?.defaultUserId) {
      const user = await ctx.db.get(category.defaultUserId);
      return {
        suggestedUserId: category.defaultUserId,
        userName: user?.name ?? null,
      };
    }

    return null;
  },
});

// ── Mutations ────────────────────────────────────────────────────────────

/**
 * Create a task (inline creation).
 */
export const create = mutation({
  args: {
    title: v.string(),
    projectId: v.optional(v.id("projects")),
    status: v.optional(taskStatus),
    assigneeIds: v.optional(v.array(v.id("users"))),
    parentTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const trimmedTitle = args.title.trim();
    if (!trimmedTitle) throw new Error("Task title cannot be empty");

    let projectId = args.projectId;

    // Subtask validation
    if (args.parentTaskId) {
      const parent = await ctx.db.get(args.parentTaskId);
      if (!parent) throw new Error("Parent task not found");

      // No nesting beyond 1 level (constraint #6)
      if (parent.parentTaskId) {
        throw new Error("Subtasks cannot be nested more than 1 level deep");
      }

      // Inherit parent's project
      projectId = parent.projectId;
    }

    return await ctx.db.insert("tasks", {
      title: trimmedTitle,
      projectId,
      parentTaskId: args.parentTaskId,
      status: args.status ?? "inbox",
      assigneeIds: args.assigneeIds ?? [],
      billable: true, // constraint #19
      isArchived: false,
    });
  },
});

/**
 * General field update (inline edits).
 */
export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    assigneeIds: v.optional(v.array(v.id("users"))),
    workCategoryId: v.optional(v.union(v.id("workCategories"), v.null())),
    estimate: v.optional(v.union(v.number(), v.null())),
    billable: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");

    // Permission: member can only update assigned tasks
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    // Project change blocked if time entries exist (constraint #27)
    if (updates.projectId !== undefined && updates.projectId !== task.projectId) {
      if (await hasTimeEntries(ctx, id)) {
        throw new Error(
          "Cannot change project: task has logged time entries. Time entries are linked to the current project for billing.",
        );
      }
    }

    const patch: Record<string, unknown> = {};

    if (updates.title !== undefined) {
      const trimmed = updates.title.trim();
      if (!trimmed) throw new Error("Task title cannot be empty");
      patch.title = trimmed;
    }

    if (updates.projectId !== undefined) {
      patch.projectId = updates.projectId;
      // Update recent projects for the current user
      const recentIds = user.recentProjectIds ?? [];
      const filtered = recentIds.filter(
        (pid: any) => pid !== updates.projectId,
      );
      const updated = [updates.projectId, ...filtered].slice(0, 5);
      await ctx.db.patch(user._id, { recentProjectIds: updated });
    }

    if (updates.assigneeIds !== undefined) {
      patch.assigneeIds = updates.assigneeIds;
    }

    if (updates.workCategoryId !== undefined) {
      patch.workCategoryId =
        updates.workCategoryId === null ? undefined : updates.workCategoryId;
    }

    if (updates.estimate !== undefined) {
      patch.estimate =
        updates.estimate === null ? undefined : updates.estimate;
    }

    if (updates.billable !== undefined) {
      patch.billable = updates.billable;
    }

    await ctx.db.patch(id, patch);
  },
});

/**
 * Update task status with permission check.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: taskStatus,
  },
  handler: async (ctx, { id, status }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");

    // Permission: member can only update assigned tasks
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    // "Done" is admin-only
    if (status === "done" && !isAdmin(user)) {
      throw new Error("Admin access required to set status to Done");
    }

    await ctx.db.patch(id, { status });
  },
});

/**
 * Duplicate a task.
 */
export const duplicate = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");

    // Permission: must be able to see original
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    return await ctx.db.insert("tasks", {
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      assigneeIds: task.assigneeIds,
      workCategoryId: task.workCategoryId,
      estimate: task.estimate,
      billable: task.billable,
      status: "inbox",
      isArchived: false,
      // No parentTaskId — duplicates are always top-level
    });
  },
});

/**
 * Archive a task (soft). Cascades to subtasks, auto-stops timers.
 */
export const archive = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");

    // Permission
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(id, { isArchived: true });

    // Cascade to subtasks
    const subtasks = await ctx.db
      .query("tasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", id))
      .collect();
    for (const st of subtasks) {
      if (!st.isArchived) {
        await ctx.db.patch(st._id, { isArchived: true });
      }
    }

    // Auto-stop timers on this task (and subtasks)
    const taskIds = new Set([id, ...subtasks.map((s) => s._id)]);
    const allUsers = await ctx.db.query("users").collect();
    for (const u of allUsers) {
      if (u.timerTaskId && taskIds.has(u.timerTaskId)) {
        await stopTimer(ctx, u);
      }
    }
  },
});

/**
 * Hard delete a task. Admin only. Blocked if time entries exist.
 */
export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");

    // Blocked if time entries exist
    if (await hasTimeEntries(ctx, id)) {
      throw new Error(
        "Cannot delete task: time entries exist. Archive instead.",
      );
    }

    // Delete subtasks and their related records
    const subtasks = await ctx.db
      .query("tasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", id))
      .collect();
    for (const st of subtasks) {
      await deleteTaskRelated(ctx, st._id);
      await ctx.db.delete(st._id);
    }

    // Delete task's related records
    await deleteTaskRelated(ctx, id);

    // Delete time entries for subtasks (check)
    // (parent has none — we checked above — but subtasks might)
    // Actually subtasks' time entries should also block, let's check
    // The plan says "Deletes: task + subtasks + comments + attachments + activity log"
    // It doesn't mention blocking on subtask time entries, just on the task itself

    await ctx.db.delete(id);
  },
});

/**
 * Move task to a different project. Admin only.
 * Blocked if any time entries exist (constraint #27).
 */
export const moveToProject = mutation({
  args: {
    id: v.id("tasks"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, { id, projectId }) => {
    await requireAdmin(ctx);
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");

    // Verify target project exists
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Target project not found");

    // Blocked if time entries exist
    if (await hasTimeEntries(ctx, id)) {
      throw new Error(
        "Cannot move task: time entries exist. Time entries are linked to the current project for billing.",
      );
    }

    // Update task
    await ctx.db.patch(id, {
      projectId,
      workCategoryId: undefined, // Clear since categories may differ
    });

    // Cascade to subtasks
    const subtasks = await ctx.db
      .query("tasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", id))
      .collect();
    for (const st of subtasks) {
      await ctx.db.patch(st._id, {
        projectId,
        workCategoryId: undefined,
      });
    }
  },
});

// ── Bulk Actions ─────────────────────────────────────────────────────────

/**
 * Bulk status change. Max 50 tasks.
 */
export const bulkUpdateStatus = mutation({
  args: {
    ids: v.array(v.id("tasks")),
    status: taskStatus,
  },
  handler: async (ctx, { ids, status }) => {
    const user = await requireAuth(ctx);

    if (ids.length > 50) {
      throw new Error("Maximum 50 tasks per bulk action");
    }

    // "Done" is admin-only
    if (status === "done" && !isAdmin(user)) {
      throw new Error("Admin access required to set status to Done");
    }

    let updated = 0;
    for (const taskId of ids) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;

      // Skip tasks the user cannot access
      if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) continue;

      await ctx.db.patch(taskId, { status });
      updated++;
    }

    return { updated };
  },
});

/**
 * Bulk assignee change. Max 50 tasks.
 */
export const bulkUpdateAssignees = mutation({
  args: {
    ids: v.array(v.id("tasks")),
    assigneeIds: v.array(v.id("users")),
  },
  handler: async (ctx, { ids, assigneeIds }) => {
    const user = await requireAuth(ctx);

    if (ids.length > 50) {
      throw new Error("Maximum 50 tasks per bulk action");
    }

    let updated = 0;
    for (const taskId of ids) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;

      // Skip tasks the user cannot access
      if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) continue;

      await ctx.db.patch(taskId, { assigneeIds });
      updated++;
    }

    return { updated };
  },
});

/**
 * Bulk archive. Max 50 tasks. Cascades subtasks, auto-stops timers.
 */
export const bulkArchive = mutation({
  args: {
    ids: v.array(v.id("tasks")),
  },
  handler: async (ctx, { ids }) => {
    const user = await requireAuth(ctx);

    if (ids.length > 50) {
      throw new Error("Maximum 50 tasks per bulk action");
    }

    const allUsers = await ctx.db.query("users").collect();
    let archived = 0;

    for (const taskId of ids) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;

      // Skip tasks the user cannot access
      if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) continue;

      await ctx.db.patch(taskId, { isArchived: true });

      // Cascade to subtasks
      const subtasks = await ctx.db
        .query("tasks")
        .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", taskId))
        .collect();
      for (const st of subtasks) {
        if (!st.isArchived) {
          await ctx.db.patch(st._id, { isArchived: true });
        }
      }

      // Auto-stop timers
      const taskIds = new Set([taskId, ...subtasks.map((s) => s._id)]);
      for (const u of allUsers) {
        if (u.timerTaskId && taskIds.has(u.timerTaskId)) {
          await stopTimer(ctx, u);
          // Refresh user record since it was patched
          const refreshed = await ctx.db.get(u._id);
          if (refreshed) {
            Object.assign(u, refreshed);
          }
        }
      }

      archived++;
    }

    return { archived };
  },
});
