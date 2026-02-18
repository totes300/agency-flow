import { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { formatDuration } from "../../lib/format";

// ── Types ────────────────────────────────────────────────────────────────

type LogActivityArgs = {
  taskId: Id<"tasks">;
  userId: Id<"users">;
  action: string;
  metadata?: Record<string, unknown>;
};

type FieldConfig = {
  label: string;
  format?: (value: unknown, ctx: MutationCtx) => string | Promise<string>;
};

// ── logActivity ──────────────────────────────────────────────────────────

/**
 * Thin typed wrapper around internal.activityLog.log.
 * Single import point for all activity logging.
 */
export async function logActivity(
  ctx: MutationCtx,
  args: LogActivityArgs,
): Promise<void> {
  await ctx.runMutation(internal.activityLog.log, {
    taskId: args.taskId,
    userId: args.userId,
    action: args.action,
    metadata: args.metadata,
  });
}

// ── TRACKED_FIELDS ───────────────────────────────────────────────────────

/**
 * Config for fields that are automatically diffed in trackFieldChanges.
 * Adding a new tracked field = adding one entry here.
 */
export const TRACKED_FIELDS: Record<string, FieldConfig> = {
  title: {
    label: "title",
    format: (v) => {
      const s = String(v);
      return s.length > 60 ? `"${s.slice(0, 57)}…"` : `"${s}"`;
    },
  },
  estimate: {
    label: "estimate",
    format: (v) => (v == null ? "none" : formatDuration(v as number)),
  },
  billable: {
    label: "billable",
    format: (v) => (v ? "yes" : "no"),
  },
  dueDate: {
    label: "due date",
    format: (v) => {
      if (v == null) return "none";
      // dueDate is stored as epoch ms
      const d = new Date(v as number);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    },
  },
  workCategoryId: {
    label: "category",
    format: async (v, ctx) => {
      if (v == null) return "none";
      const cat = await ctx.db.get(v as Id<"workCategories">);
      return cat?.name ?? "unknown";
    },
  },
  projectId: {
    label: "project",
    format: async (v, ctx) => {
      if (v == null) return "none";
      const project = await ctx.db.get(v as Id<"projects">);
      return project?.name ?? "unknown";
    },
  },
  assigneeIds: {
    label: "assignees",
    format: async (v, ctx) => {
      const ids = v as Id<"users">[];
      if (!ids || ids.length === 0) return "none";
      const names = await Promise.all(
        ids.map(async (id) => {
          const u = await ctx.db.get(id);
          return u?.name ?? "unknown";
        }),
      );
      return names.join(", ");
    },
  },
};

// ── trackFieldChanges ────────────────────────────────────────────────────

/**
 * Diffs old/new objects against TRACKED_FIELDS and generates one log entry
 * per changed field. Handles set/removed/changed patterns automatically.
 */
export async function trackFieldChanges(
  ctx: MutationCtx,
  args: {
    taskId: Id<"tasks">;
    userId: Id<"users">;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
): Promise<void> {
  for (const [field, config] of Object.entries(TRACKED_FIELDS)) {
    const oldVal = args.before[field];
    const newVal = args.after[field];

    // Skip unchanged fields
    if (isEqual(oldVal, newVal)) continue;

    const format = config.format ?? ((v) => String(v ?? "none"));
    const oldFormatted = await format(oldVal, ctx);
    const newFormatted = await format(newVal, ctx);

    let action: string;
    const oldEmpty = isEmptyValue(oldVal);
    const newEmpty = isEmptyValue(newVal);

    if (oldEmpty && !newEmpty) {
      action = `set ${config.label} to ${newFormatted}`;
    } else if (!oldEmpty && newEmpty) {
      action = `removed ${config.label}`;
    } else {
      action = `changed ${config.label} ${oldFormatted} → ${newFormatted}`;
    }

    await logActivity(ctx, {
      taskId: args.taskId,
      userId: args.userId,
      action,
    });
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  return false;
}
