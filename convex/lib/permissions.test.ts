import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

/**
 * Tests for role-based permission helpers.
 * These test the helpers indirectly through Convex functions,
 * since the helpers require Convex context objects.
 */

async function seedUser(
  t: ReturnType<typeof convexTest>,
  clerkId: string,
  role: "admin" | "member",
  name = "Test User",
) {
  await t.mutation(internal.users.upsertFromClerk, {
    data: {
      id: clerkId,
      first_name: name.split(" ")[0],
      last_name: name.split(" ")[1] ?? "",
      email_addresses: [
        { id: "email_1", email_address: `${clerkId}@test.com` },
      ],
      primary_email_address_id: "email_1",
      public_metadata: { role },
    },
  });
}

describe("permissions - getCurrentUser / requireAuth", () => {
  it("getMe returns user for authenticated identity", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "admin_1", "admin", "Admin User");

    const asAdmin = t.withIdentity({ subject: "admin_1" });
    const user = await asAdmin.query(api.users.getMe);
    expect(user).not.toBeNull();
    expect(user!.role).toBe("admin");
  });

  it("getMe returns null for unauthenticated request", async () => {
    const t = convexTest(schema, modules);
    const user = await t.query(api.users.getMe);
    expect(user).toBeNull();
  });
});

describe("permissions - isAdmin logic", () => {
  it("admin role is correctly set from Clerk metadata", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "admin_test", "admin", "Admin Person");

    const asAdmin = t.withIdentity({ subject: "admin_test" });
    const user = await asAdmin.query(api.users.getMe);
    expect(user!.role).toBe("admin");
  });

  it("member role is correctly set from Clerk metadata", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "member_test", "member", "Member Person");

    const asMember = t.withIdentity({ subject: "member_test" });
    const user = await asMember.query(api.users.getMe);
    expect(user!.role).toBe("member");
  });

  it("role updates when Clerk metadata changes", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "role_change", "member", "Role Changer");

    // Promote to admin
    await seedUser(t, "role_change", "admin", "Role Changer");

    const asUser = t.withIdentity({ subject: "role_change" });
    const user = await asUser.query(api.users.getMe);
    expect(user!.role).toBe("admin");
  });
});
