import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const taskStatus = v.union(
  v.literal("inbox"),
  v.literal("today"),
  v.literal("next_up"),
  v.literal("admin_review"),
  v.literal("stuck"),
  v.literal("done"),
);

export const billingType = v.union(
  v.literal("fixed"),
  v.literal("retainer"),
  v.literal("t_and_m"),
);

export const retainerStatus = v.union(
  v.literal("active"),
  v.literal("inactive"),
);

export const timesheetStatus = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("paid"),
);

export const userRole = v.union(v.literal("admin"), v.literal("member"));

export const timeEntryMethod = v.union(
  v.literal("timer"),
  v.literal("manual"),
);

export default defineSchema({
  // ── Users ──────────────────────────────────────────────────────────
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
    role: userRole,
    // Server-side timer state (constraint #11)
    timerTaskId: v.optional(v.id("tasks")),
    timerStartedAt: v.optional(v.number()),
    // Recent projects for quick access
    recentProjectIds: v.optional(v.array(v.id("projects"))),
    // GDPR anonymization
    isAnonymized: v.optional(v.boolean()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  // ── Clients ────────────────────────────────────────────────────────
  clients: defineTable({
    name: v.string(),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    currency: v.string(), // ISO 4217 code: EUR, USD, HUF, etc.
    isArchived: v.boolean(),
  }).index("by_isArchived", ["isArchived"]),

  // ── Projects ───────────────────────────────────────────────────────
  projects: defineTable({
    clientId: v.id("clients"),
    name: v.string(),
    billingType: billingType,
    isArchived: v.boolean(),
    // Retainer-specific fields
    retainerStatus: v.optional(retainerStatus),
    includedHoursPerMonth: v.optional(v.number()), // stored as minutes
    overageRate: v.optional(v.number()),
    startDate: v.optional(v.string()), // YYYY-MM-DD, for retainers
    // T&M-specific fields
    hourlyRate: v.optional(v.number()), // single flat rate
    tmCategoryRates: v.optional(
      v.array(
        v.object({
          workCategoryId: v.id("workCategories"),
          rate: v.number(),
        }),
      ),
    ),
    // T&M: date of last invoice (YYYY-MM-DD), set manually by admin
    lastInvoicedAt: v.optional(v.string()),
    // Default assignees per work category (UC-2.5)
    defaultAssignees: v.optional(
      v.array(
        v.object({
          workCategoryId: v.id("workCategories"),
          userId: v.id("users"),
        }),
      ),
    ),
  })
    .index("by_clientId", ["clientId"])
    .index("by_isArchived", ["isArchived"])
    .index("by_clientId_isArchived", ["clientId", "isArchived"]),

  // ── Work Categories (global, admin-managed) ────────────────────────
  workCategories: defineTable({
    name: v.string(),
    isArchived: v.boolean(),
    defaultUserId: v.optional(v.id("users")),
    defaultCostRate: v.optional(v.number()),
    defaultBillRate: v.optional(v.number()),
  }),

  // ── Project Category Estimates (Fixed projects) ────────────────────
  projectCategoryEstimates: defineTable({
    projectId: v.id("projects"),
    workCategoryId: v.id("workCategories"),
    estimatedMinutes: v.number(), // constraint #4: integer minutes
    internalCostRate: v.optional(v.number()),
    clientBillingRate: v.optional(v.number()),
  })
    .index("by_projectId", ["projectId"])
    .index("by_projectId_workCategoryId", ["projectId", "workCategoryId"]),

  // ── Tasks ──────────────────────────────────────────────────────────
  tasks: defineTable({
    projectId: v.optional(v.id("projects")),
    parentTaskId: v.optional(v.id("tasks")), // 1-level subtasks only (#6)
    title: v.string(),
    description: v.optional(v.any()), // Tiptap JSON (#13)
    status: taskStatus,
    assigneeIds: v.array(v.id("users")),
    workCategoryId: v.optional(v.id("workCategories")),
    estimate: v.optional(v.number()), // integer minutes (#4)
    sortOrder: v.optional(v.number()), // subtask ordering
    billable: v.boolean(), // defaults true (#19)
    clientUpdateText: v.optional(v.string()),
    isArchived: v.boolean(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_parentTaskId", ["parentTaskId"])
    .index("by_status", ["status"])
    .index("by_isArchived", ["isArchived"])
    .index("by_projectId_isArchived", ["projectId", "isArchived"])
    .index("by_assigneeIds", ["assigneeIds"]),

  // ── Time Entries ───────────────────────────────────────────────────
  timeEntries: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD (#12)
    durationMinutes: v.number(), // integer minutes, rounded up (#3)
    note: v.optional(v.string()),
    method: timeEntryMethod,
  })
    .index("by_taskId", ["taskId"])
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"])
    .index("by_taskId_date", ["taskId", "date"]),

  // ── Comments ───────────────────────────────────────────────────────
  comments: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    content: v.any(), // Tiptap JSON with mention nodes (#20)
    mentionedUserIds: v.array(v.id("users")),
  })
    .index("by_taskId", ["taskId"]),

  // ── Attachments ────────────────────────────────────────────────────
  attachments: defineTable({
    taskId: v.id("tasks"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(), // bytes, max 10MB (#22)
    uploadedBy: v.id("users"),
  })
    .index("by_taskId", ["taskId"]),

  // ── Activity Log ───────────────────────────────────────────────────
  activityLogEntries: defineTable({
    taskId: v.id("tasks"),
    action: v.string(),
    userId: v.id("users"),
    metadata: v.optional(v.any()),
  })
    .index("by_taskId", ["taskId"]),

  // ── Notifications ──────────────────────────────────────────────────
  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(),
    relatedEntityId: v.optional(v.string()),
    relatedEntityType: v.optional(v.string()),
    message: v.string(),
    isRead: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_isRead", ["userId", "isRead"]),

  // ── Timesheets ─────────────────────────────────────────────────────
  timesheets: defineTable({
    clientId: v.id("clients"),
    period: v.string(), // YYYY-MM
    status: timesheetStatus,
    generatedAt: v.number(), // timestamp
    data: v.optional(v.any()), // frozen JSON blob for sent/paid (#16)
  })
    .index("by_clientId", ["clientId"])
    .index("by_clientId_period", ["clientId", "period"]),

  // ── Retainer Periods ───────────────────────────────────────────────
  retainerPeriods: defineTable({
    projectId: v.id("projects"),
    periodStart: v.string(), // YYYY-MM-DD
    periodEnd: v.string(), // YYYY-MM-DD
    includedMinutes: v.number(),
    rolloverMinutes: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_projectId_periodStart", ["projectId", "periodStart"]),

  // ── Workspace Settings (singleton) ─────────────────────────────────
  workspaceSettings: defineTable({
    defaultHourlyRate: v.optional(v.number()),
  }),

  // ── Today Order (per-user task ordering) ───────────────────────────
  todayOrder: defineTable({
    userId: v.id("users"),
    taskIds: v.array(v.id("tasks")),
  })
    .index("by_userId", ["userId"]),
});
