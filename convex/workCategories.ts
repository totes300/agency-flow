import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireAuth } from "./lib/permissions";

const DEFAULT_CATEGORIES = [
  "Design",
  "Development",
  "Copywriting",
  "Project Management",
  "Testing",
  "Wireframing",
];

/**
 * List active (non-archived) work categories.
 * Available to all authenticated users (used in pickers).
 * Enriched with default user name.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const all = await ctx.db.query("workCategories").collect();
    const active = all.filter((c) => !c.isArchived);
    return Promise.all(
      active.map(async (c) => {
        const defaultUser = c.defaultUserId
          ? await ctx.db.get(c.defaultUserId)
          : null;
        // Exclude billing-sensitive rate fields (Security #5)
        return {
          _id: c._id,
          _creationTime: c._creationTime,
          name: c.name,
          isArchived: c.isArchived,
          defaultUserId: c.defaultUserId,
          defaultUserName: defaultUser?.name ?? null,
        };
      }),
    );
  },
});

/**
 * List all work categories including archived (admin management view).
 * Enriched with default user name.
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("workCategories").collect();
    return Promise.all(
      all.map(async (c) => {
        const defaultUser = c.defaultUserId
          ? await ctx.db.get(c.defaultUserId)
          : null;
        return {
          ...c,
          defaultUserName: defaultUser?.name ?? null,
        };
      }),
    );
  },
});

/**
 * Create a new work category. Admin only.
 */
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    await requireAdmin(ctx);
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Category name cannot be empty");

    // Check for duplicate name (case-insensitive)
    const existing = await ctx.db.query("workCategories").collect();
    const duplicate = existing.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase() && !c.isArchived,
    );
    if (duplicate) throw new Error("A category with this name already exists");

    return await ctx.db.insert("workCategories", {
      name: trimmed,
      isArchived: false,
    });
  },
});

/**
 * Rename a work category. Admin only.
 */
export const rename = mutation({
  args: { id: v.id("workCategories"), name: v.string() },
  handler: async (ctx, { id, name }) => {
    await requireAdmin(ctx);
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Category name cannot be empty");

    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");

    // Check for duplicate name (case-insensitive), excluding self
    const existing = await ctx.db.query("workCategories").collect();
    const duplicate = existing.find(
      (c) =>
        c._id !== id &&
        c.name.toLowerCase() === trimmed.toLowerCase() &&
        !c.isArchived,
    );
    if (duplicate) throw new Error("A category with this name already exists");

    await ctx.db.patch(id, { name: trimmed });
  },
});

/**
 * Archive a work category. Admin only.
 * Archived categories are hidden from pickers but existing references are preserved.
 */
export const archive = mutation({
  args: { id: v.id("workCategories") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");
    await ctx.db.patch(id, { isArchived: true });
  },
});

/**
 * Unarchive a work category. Admin only.
 */
export const unarchive = mutation({
  args: { id: v.id("workCategories") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");
    await ctx.db.patch(id, { isArchived: false });
  },
});

/**
 * Set or clear the global default user for a work category. Admin only.
 */
export const setDefaultUser = mutation({
  args: {
    id: v.id("workCategories"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { id, userId }) => {
    await requireAdmin(ctx);
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");

    if (userId) {
      const user = await ctx.db.get(userId);
      if (!user) throw new Error("User not found");
    }

    await ctx.db.patch(id, { defaultUserId: userId });
  },
});

/**
 * Set the default cost rate for a work category. Admin only.
 * Pass rate to set, omit to clear.
 */
export const setDefaultCostRate = mutation({
  args: {
    id: v.id("workCategories"),
    rate: v.optional(v.number()),
  },
  handler: async (ctx, { id, rate }) => {
    await requireAdmin(ctx);
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");
    if (rate !== undefined && rate < 0) {
      throw new Error("Cost rate cannot be negative");
    }
    await ctx.db.patch(id, { defaultCostRate: rate });
  },
});

/**
 * Set the default billing rate for a work category. Admin only.
 * Pass rate to set, omit to clear.
 */
export const setDefaultBillRate = mutation({
  args: {
    id: v.id("workCategories"),
    rate: v.optional(v.number()),
  },
  handler: async (ctx, { id, rate }) => {
    await requireAdmin(ctx);
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");
    if (rate !== undefined && rate < 0) {
      throw new Error("Bill rate cannot be negative");
    }
    await ctx.db.patch(id, { defaultBillRate: rate });
  },
});

/**
 * Seed default work categories if none exist.
 * Called on first admin setup or explicitly by admin.
 */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("workCategories").collect();
    if (existing.length > 0) return;

    for (const name of DEFAULT_CATEGORIES) {
      await ctx.db.insert("workCategories", { name, isArchived: false });
    }
  },
});
