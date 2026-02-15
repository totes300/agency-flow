import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { userRole } from "./schema";

/**
 * Upsert user from Clerk webhook data.
 * Called by the webhook handler on user.created and user.updated events.
 */
export const upsertFromClerk = internalMutation({
  args: {
    data: v.any(),
  },
  handler: async (ctx, { data }) => {
    const clerkId = data.id as string;
    const email =
      data.email_addresses?.find(
        (e: { id: string }) => e.id === data.primary_email_address_id,
      )?.email_address ?? "";
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || email;
    const avatarUrl = data.image_url ?? undefined;
    const role = (data.public_metadata?.role as "admin" | "member") ?? "member";

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        email,
        avatarUrl,
        role,
      });
    } else {
      await ctx.db.insert("users", {
        clerkId,
        name,
        email,
        avatarUrl,
        role,
      });
    }
  },
});

/**
 * Delete (anonymize) user from Clerk webhook.
 * Per GDPR data lifecycle rules: anonymize rather than delete.
 */
export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkUserId))
      .unique();
    if (user) {
      await ctx.db.patch(user._id, {
        name: "Former Team Member",
        email: "",
        avatarUrl: undefined,
        isAnonymized: true,
      });
    }
  },
});

/**
 * Get the current authenticated user from Convex.
 * Returns null if the user hasn't been synced yet (webhook delay).
 */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) =>
        q.eq("clerkId", identity.subject),
      )
      .unique();

    return user;
  },
});
