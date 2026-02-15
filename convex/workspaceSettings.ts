import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/permissions";

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const doc = await ctx.db.query("workspaceSettings").first();
    return doc ?? null;
  },
});

export const update = mutation({
  args: {
    defaultHourlyRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if ("defaultHourlyRate" in args && args.defaultHourlyRate !== undefined) {
      if (args.defaultHourlyRate < 0) {
        throw new Error("Default hourly rate cannot be negative");
      }
    }

    const existing = await ctx.db.query("workspaceSettings").first();

    const patch: Record<string, number | undefined> = {};
    if ("defaultHourlyRate" in args) {
      patch.defaultHourlyRate = args.defaultHourlyRate;
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    } else {
      return await ctx.db.insert("workspaceSettings", {
        defaultHourlyRate: args.defaultHourlyRate,
      });
    }
  },
});
