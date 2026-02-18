import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requireAdmin, requireAuth, isAdmin } from "./lib/permissions";
import { stopUserTimer } from "./lib/timerHelpers";
import { logActivity, trackFieldChanges } from "./lib/activityLogger";
import { taskStatus } from "./schema";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Check whether a task has any time entries. */
async function hasTimeEntries(ctx: MutationCtx, taskId: Doc<"tasks">["_id"]): Promise<boolean> {
  const entry = await ctx.db
    .query("timeEntries")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .first();
  return entry !== null;
}

/** Delete all related records for a task (comments, attachments, activity log, views). */
async function deleteTaskRelated(ctx: MutationCtx, taskId: Doc<"tasks">["_id"]) {
  const comments = await ctx.db
    .query("comments")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .collect();
  for (const c of comments) await ctx.db.delete(c._id);

  const attachments = await ctx.db
    .query("attachments")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .collect();
  for (const a of attachments) await ctx.db.delete(a._id);

  const logs = await ctx.db
    .query("activityLogEntries")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .collect();
  for (const l of logs) await ctx.db.delete(l._id);

  // Clean up task views
  const views = await ctx.db
    .query("taskViews")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .collect();
  for (const v of views) await ctx.db.delete(v._id);
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
      task.assigneeIds.map(async (uid) => {
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
      .withIndex("by_taskId", (q) => q.eq("taskId", id))
      .collect();
    const totalMinutes = timeEntries.reduce(
      (sum, e) => sum + e.durationMinutes,
      0,
    );

    // Subtasks
    const subtasks = await ctx.db
      .query("tasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", id))
      .collect();

    subtasks.sort((a, b) => {
      const aOrder = a.sortOrder ?? a._creationTime;
      const bOrder = b.sortOrder ?? b._creationTime;
      return aOrder - bOrder;
    });

    let subtaskTotalMinutes = 0;
    for (const st of subtasks) {
      const stEntries = await ctx.db
        .query("timeEntries")
        .withIndex("by_taskId", (q) => q.eq("taskId", st._id))
        .collect();
      subtaskTotalMinutes += stEntries.reduce(
        (sum, e) => sum + e.durationMinutes,
        0,
      );
    }

    const enrichedSubtasks = subtasks.map((st) => ({
      _id: st._id,
      title: st.title,
      status: st.status,
      sortOrder: st.sortOrder,
      _creationTime: st._creationTime,
    }));

    // Fetch task view for current user
    const taskView = await ctx.db
      .query("taskViews")
      .withIndex("by_taskId_userId", (q) =>
        q.eq("taskId", id).eq("userId", user._id),
      )
      .first();

    return {
      ...task,
      projectName,
      clientName,
      clientId,
      projectBillingType,
      assignees: assignees.filter(Boolean),
      workCategoryName,
      totalMinutes,
      subtasks: enrichedSubtasks,
      subtaskTotalMinutes,
      lastViewedAt: taskView?.viewedAt ?? null,
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

    // Use index-based query for better performance (filter non-archived first)
    let allTasks: Doc<"tasks">[];
    if (!args.includeArchived) {
      allTasks = await ctx.db
        .query("tasks")
        .withIndex("by_isArchived", (q) => q.eq("isArchived", false))
        .collect();
    } else {
      allTasks = await ctx.db.query("tasks").collect();
    }

    // Exclude subtasks from main list (constraint #7)
    allTasks = allTasks.filter((t) => !t.parentTaskId);

    // Role scoping: member sees only assigned tasks
    if (!admin) {
      allTasks = allTasks.filter((t) => t.assigneeIds.includes(user._id));
    }

    // Build project→client lookup (always needed for enrichment)
    const projects = await ctx.db.query("projects").collect();
    const projectMap = new Map(projects.map((p) => [p._id, p]));

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

    // Batch-fetch task views for current user
    const taskViewsByTask = new Map<string, number>();
    for (const task of page) {
      const view = await ctx.db
        .query("taskViews")
        .withIndex("by_taskId_userId", (q) =>
          q.eq("taskId", task._id).eq("userId", user._id),
        )
        .first();
      if (view) {
        taskViewsByTask.set(task._id, view.viewedAt);
      }
    }

    // Per-task indexed lookups for subtasks, comments, time entries, activity (max 50 tasks)
    const subtasksByParent = new Map<string, Doc<"tasks">[]>();
    const commentsByTask = new Map<string, Doc<"comments">[]>();
    const minutesByTask = new Map<string, number>();
    const latestActivityByTask = new Map<string, Doc<"activityLogEntries">[]>();

    for (const task of page) {
      // Subtasks via index
      const subtasks = await ctx.db
        .query("tasks")
        .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", task._id))
        .collect();
      if (subtasks.length > 0) {
        subtasksByParent.set(task._id, subtasks);
      }

      // Comments via index
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .collect();
      if (comments.length > 0) {
        commentsByTask.set(task._id, comments);
      }

      // Time entries via index
      const timeEntries = await ctx.db
        .query("timeEntries")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .collect();
      const totalMin = timeEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
      if (totalMin > 0) {
        minutesByTask.set(task._id, totalMin);
      }

      // Activity log — use .order("desc").take(5) instead of .collect() + sort + slice
      const activityEntries = await ctx.db
        .query("activityLogEntries")
        .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
        .order("desc")
        .take(5);
      if (activityEntries.length > 0) {
        latestActivityByTask.set(task._id, activityEntries);
      }
    }

    // Enrich each task
    const enrichedPage = page.map((task) => {
      const project = task.projectId ? projectMap.get(task.projectId) : null;
      const client = project ? clientMap.get(project.clientId) : null;

      const assignees = task.assigneeIds
        .map((uid) => {
          const u = userMap.get(uid);
          return u
            ? { _id: u._id, name: u.name, avatarUrl: u.avatarUrl }
            : null;
        })
        .filter((a): a is NonNullable<typeof a> => a !== null);

      const category = task.workCategoryId
        ? categoryMap.get(task.workCategoryId)
        : null;

      const subtasks = subtasksByParent.get(task._id) ?? [];
      const completedSubtaskCount = subtasks.filter(
        (s) => s.status === "done",
      ).length;

      const comments = commentsByTask.get(task._id) ?? [];
      // Sort comments by _creationTime descending for latest
      const sortedComments = [...comments].sort((a, b) => b._creationTime - a._creationTime);
      const latestComment = sortedComments[0]
        ? (() => {
            const commentUser = userMap.get(sortedComments[0].userId);
            return {
              userName: commentUser?.name ?? "Unknown",
              avatarUrl: commentUser?.avatarUrl,
              content: typeof sortedComments[0].content === "string"
                ? sortedComments[0].content.slice(0, 200)
                : "Comment",
              _creationTime: sortedComments[0]._creationTime,
            };
          })()
        : undefined;

      // Subtask preview (first 5)
      const subtaskPreview = subtasks.slice(0, 5).map((s) => ({
        _id: s._id,
        title: s.title,
        status: s.status,
      }));

      // Description preview (plain text extraction from Tiptap JSON)
      let descriptionPreview: string | undefined;
      if (task.description) {
        try {
          const extractText = (node: Record<string, unknown>): string => {
            if (typeof node === "string") return node;
            let text = "";
            if (node.text) text += node.text;
            if (Array.isArray(node.content)) {
              for (const child of node.content) {
                text += extractText(child);
              }
            }
            return text;
          };
          const plainText = extractText(task.description as Record<string, unknown>);
          descriptionPreview = plainText.slice(0, 200) || undefined;
        } catch {
          descriptionPreview = undefined;
        }
      }

      // Latest activity entries with user names
      const activityEntries = latestActivityByTask.get(task._id) ?? [];
      const latestActivityLog = activityEntries.map((entry) => {
        const actUser = userMap.get(entry.userId);
        return {
          action: entry.action,
          userName: actUser?.name ?? "Unknown",
          avatarUrl: actUser?.avatarUrl,
          _creationTime: entry._creationTime,
        };
      });

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
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        lastEditedAt: task.lastEditedAt,
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
        lastViewedAt: taskViewsByTask.get(task._id) ?? null,
        latestActivityLog,
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
      (a) => a.workCategoryId === workCategoryId,
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
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

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

    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      title: trimmedTitle,
      projectId,
      parentTaskId: args.parentTaskId,
      status: args.status ?? "inbox",
      assigneeIds: args.assigneeIds ?? [],
      billable: true, // constraint #19
      isArchived: false,
      dueDate: args.dueDate,
      createdAt: now,
      lastEditedAt: now,
    });

    await logActivity(ctx, {
      taskId,
      userId: user._id,
      action: "created task",
    });

    return taskId;
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
    dueDate: v.optional(v.union(v.number(), v.null())),
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
        (pid) => pid !== updates.projectId,
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
      if (updates.estimate !== null) {
        if (!Number.isInteger(updates.estimate) || updates.estimate < 0) {
          throw new Error("Estimate must be a non-negative integer (minutes)");
        }
      }
      patch.estimate =
        updates.estimate === null ? undefined : updates.estimate;
    }

    if (updates.billable !== undefined) {
      patch.billable = updates.billable;
    }

    if (updates.dueDate !== undefined) {
      patch.dueDate = updates.dueDate === null ? undefined : updates.dueDate;
    }

    patch.lastEditedAt = Date.now();

    // Snapshot before for diffing
    const before: Record<string, unknown> = {
      title: task.title,
      estimate: task.estimate,
      billable: task.billable,
      dueDate: task.dueDate,
      workCategoryId: task.workCategoryId,
      projectId: task.projectId,
      assigneeIds: task.assigneeIds,
    };

    await ctx.db.patch(id, patch);

    // Build after snapshot from applied patch
    const after: Record<string, unknown> = { ...before };
    if (patch.title !== undefined) after.title = patch.title;
    if (patch.estimate !== undefined) after.estimate = patch.estimate;
    if (patch.billable !== undefined) after.billable = patch.billable;
    if (patch.dueDate !== undefined) after.dueDate = patch.dueDate;
    if (patch.workCategoryId !== undefined) after.workCategoryId = patch.workCategoryId;
    if (patch.projectId !== undefined) after.projectId = patch.projectId;
    if (patch.assigneeIds !== undefined) after.assigneeIds = patch.assigneeIds;

    await trackFieldChanges(ctx, {
      taskId: id,
      userId: user._id,
      before,
      after,
    });
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

    await ctx.db.patch(id, { status, lastEditedAt: Date.now() });

    await logActivity(ctx, {
      taskId: id,
      userId: user._id,
      action: `changed status ${task.status} → ${status}`,
    });
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

    const now = Date.now();
    const newTaskId = await ctx.db.insert("tasks", {
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      assigneeIds: task.assigneeIds,
      workCategoryId: task.workCategoryId,
      estimate: task.estimate,
      billable: task.billable,
      status: "inbox",
      isArchived: false,
      dueDate: task.dueDate,
      createdAt: now,
      lastEditedAt: now,
      // No parentTaskId — duplicates are always top-level
    });

    await logActivity(ctx, {
      taskId: newTaskId,
      userId: user._id,
      action: `duplicated from "${task.title.length > 60 ? task.title.slice(0, 57) + "…" : task.title}"`,
    });

    return newTaskId;
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

    await ctx.db.patch(id, { isArchived: true, lastEditedAt: Date.now() });

    await logActivity(ctx, {
      taskId: id,
      userId: user._id,
      action: "archived task",
    });

    // Cascade to subtasks
    const subtasks = await ctx.db
      .query("tasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", id))
      .collect();
    for (const st of subtasks) {
      if (!st.isArchived) {
        await ctx.db.patch(st._id, { isArchived: true, lastEditedAt: Date.now() });
      }
    }

    // Auto-stop timers on this task (and subtasks)
    const taskIds = new Set([id, ...subtasks.map((s) => s._id)]);
    const allUsers = await ctx.db.query("users").collect();
    for (const u of allUsers) {
      if (u.timerTaskId && taskIds.has(u.timerTaskId)) {
        await stopUserTimer(ctx, u);
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

    // Check subtasks for time entries too
    for (const st of subtasks) {
      if (await hasTimeEntries(ctx, st._id)) {
        throw new Error(
          "Cannot delete: subtask has time entries. Archive instead.",
        );
      }
    }

    for (const st of subtasks) {
      await deleteTaskRelated(ctx, st._id);
      await ctx.db.delete(st._id);
    }

    // Delete task's related records
    await deleteTaskRelated(ctx, id);
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
    const user = await requireAdmin(ctx);
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

    // Check subtasks for time entries too
    const subtasks = await ctx.db
      .query("tasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", id))
      .collect();
    for (const st of subtasks) {
      if (await hasTimeEntries(ctx, st._id)) {
        throw new Error(
          "Cannot move task: subtask has time entries. Time entries are linked to the current project for billing.",
        );
      }
    }

    // Lookup old project name for logging
    const oldProject = task.projectId ? await ctx.db.get(task.projectId) : null;
    const oldProjectName = oldProject?.name ?? "none";
    const newProjectName = project.name;

    // Update task
    await ctx.db.patch(id, {
      projectId,
      workCategoryId: undefined, // Clear since categories may differ
      lastEditedAt: Date.now(),
    });

    // Cascade to subtasks
    for (const st of subtasks) {
      await ctx.db.patch(st._id, {
        projectId,
        workCategoryId: undefined,
        lastEditedAt: Date.now(),
      });
    }

    await logActivity(ctx, {
      taskId: id,
      userId: user._id,
      action: `moved to project "${newProjectName}" from "${oldProjectName}"`,
    });
  },
});

/**
 * Update task description (Tiptap JSON). Auto-saved with debounce on the client.
 */
export const updateDescription = mutation({
  args: {
    id: v.id("tasks"),
    description: v.any(),
  },
  handler: async (ctx, { id, description }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }
    await ctx.db.patch(id, { description, lastEditedAt: Date.now() });
    await logActivity(ctx, {
      taskId: id,
      userId: user._id,
      action: "edited description",
    });
  },
});

/**
 * Swap a subtask's order with its sibling (up or down).
 */
export const swapSubtaskOrder = mutation({
  args: {
    taskId: v.id("tasks"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, { taskId, direction }) => {
    await requireAuth(ctx);
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!task.parentTaskId) throw new Error("Not a subtask");

    const siblings = await ctx.db
      .query("tasks")
      .withIndex("by_parentTaskId", (q) =>
        q.eq("parentTaskId", task.parentTaskId),
      )
      .collect();

    siblings.sort((a, b) => {
      const aOrder = a.sortOrder ?? a._creationTime;
      const bOrder = b.sortOrder ?? b._creationTime;
      return aOrder - bOrder;
    });

    const idx = siblings.findIndex((s) => s._id === taskId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const current = siblings[idx];
    const swap = siblings[swapIdx];
    const currentOrder = current.sortOrder ?? current._creationTime;
    const swapOrder = swap.sortOrder ?? swap._creationTime;

    await ctx.db.patch(current._id, { sortOrder: swapOrder });
    await ctx.db.patch(swap._id, { sortOrder: currentOrder });
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

    const now = Date.now();
    let updated = 0;
    for (const taskId of ids) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;

      // Skip tasks the user cannot access
      if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) continue;

      const oldStatus = task.status;
      await ctx.db.patch(taskId, { status, lastEditedAt: now });
      if (oldStatus !== status) {
        await logActivity(ctx, {
          taskId,
          userId: user._id,
          action: `changed status ${oldStatus} → ${status}`,
        });
      }
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

    const now = Date.now();
    let updated = 0;
    for (const taskId of ids) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;

      // Skip tasks the user cannot access
      if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) continue;

      await ctx.db.patch(taskId, { assigneeIds, lastEditedAt: now });
      await logActivity(ctx, {
        taskId,
        userId: user._id,
        action: "updated assignees",
      });
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
    const now = Date.now();
    let archived = 0;

    for (const taskId of ids) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;

      // Skip tasks the user cannot access
      if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) continue;

      await ctx.db.patch(taskId, { isArchived: true, lastEditedAt: now });
      await logActivity(ctx, {
        taskId,
        userId: user._id,
        action: "archived task",
      });

      // Cascade to subtasks
      const subtasks = await ctx.db
        .query("tasks")
        .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", taskId))
        .collect();
      for (const st of subtasks) {
        if (!st.isArchived) {
          await ctx.db.patch(st._id, { isArchived: true, lastEditedAt: now });
        }
      }

      // Auto-stop timers
      const taskIds = new Set([taskId, ...subtasks.map((s) => s._id)]);
      for (const u of allUsers) {
        if (u.timerTaskId && taskIds.has(u.timerTaskId)) {
          await stopUserTimer(ctx, u);
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

/**
 * Record that the current user viewed a task (upsert taskViews record).
 */
export const recordView = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const user = await requireAuth(ctx);

    // Verify task exists and user has permission
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    const existing = await ctx.db
      .query("taskViews")
      .withIndex("by_taskId_userId", (q) =>
        q.eq("taskId", taskId).eq("userId", user._id),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { viewedAt: Date.now() });
    } else {
      await ctx.db.insert("taskViews", {
        taskId,
        userId: user._id,
        viewedAt: Date.now(),
      });
    }
  },
});
