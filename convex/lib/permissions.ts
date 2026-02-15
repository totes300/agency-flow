import {
  QueryCtx,
  MutationCtx,
} from "../_generated/server";
import { Doc } from "../_generated/dataModel";

/**
 * Get the current authenticated user from Convex.
 * Returns null if identity not found or user not synced yet.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/**
 * Require an authenticated user. Throws if not authenticated or not synced.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

/**
 * Require an admin user. Throws if not authenticated or not admin.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (!isAdmin(user)) {
    throw new Error("Admin access required");
  }
  return user;
}

/**
 * Check if a user has admin role.
 */
export function isAdmin(user: Doc<"users">): boolean {
  return user.role === "admin";
}
