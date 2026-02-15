import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("users.upsertFromClerk", () => {
  it("creates a new user from Clerk webhook data", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.users.upsertFromClerk, {
      data: {
        id: "clerk_user_1",
        first_name: "Adam",
        last_name: "Toth",
        email_addresses: [
          {
            id: "email_1",
            email_address: "adam@konverted.com",
          },
        ],
        primary_email_address_id: "email_1",
        image_url: "https://example.com/avatar.jpg",
        public_metadata: { role: "admin" },
      },
    });

    const asUser = t.withIdentity({ subject: "clerk_user_1" });
    const user = await asUser.query(api.users.getMe);

    expect(user).not.toBeNull();
    expect(user!.name).toBe("Adam Toth");
    expect(user!.email).toBe("adam@konverted.com");
    expect(user!.role).toBe("admin");
    expect(user!.avatarUrl).toBe("https://example.com/avatar.jpg");
    expect(user!.clerkId).toBe("clerk_user_1");
  });

  it("updates an existing user on second upsert", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.users.upsertFromClerk, {
      data: {
        id: "clerk_user_2",
        first_name: "Jane",
        last_name: "Doe",
        email_addresses: [
          { id: "email_1", email_address: "jane@example.com" },
        ],
        primary_email_address_id: "email_1",
        public_metadata: { role: "member" },
      },
    });

    // Update name and role
    await t.mutation(internal.users.upsertFromClerk, {
      data: {
        id: "clerk_user_2",
        first_name: "Jane",
        last_name: "Smith",
        email_addresses: [
          { id: "email_1", email_address: "jane@example.com" },
        ],
        primary_email_address_id: "email_1",
        public_metadata: { role: "admin" },
      },
    });

    const asUser = t.withIdentity({ subject: "clerk_user_2" });
    const user = await asUser.query(api.users.getMe);

    expect(user!.name).toBe("Jane Smith");
    expect(user!.role).toBe("admin");
  });

  it("defaults to member role when no role in metadata", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.users.upsertFromClerk, {
      data: {
        id: "clerk_user_3",
        first_name: "No",
        last_name: "Role",
        email_addresses: [
          { id: "email_1", email_address: "norole@example.com" },
        ],
        primary_email_address_id: "email_1",
        public_metadata: {},
      },
    });

    const asUser = t.withIdentity({ subject: "clerk_user_3" });
    const user = await asUser.query(api.users.getMe);

    expect(user!.role).toBe("member");
  });
});

describe("users.deleteFromClerk", () => {
  it("anonymizes user on delete (GDPR)", async () => {
    const t = convexTest(schema, modules);

    // Create user first
    await t.mutation(internal.users.upsertFromClerk, {
      data: {
        id: "clerk_user_del",
        first_name: "To",
        last_name: "Delete",
        email_addresses: [
          { id: "email_1", email_address: "delete@example.com" },
        ],
        primary_email_address_id: "email_1",
        public_metadata: { role: "member" },
      },
    });

    // Delete (anonymize)
    await t.mutation(internal.users.deleteFromClerk, {
      clerkUserId: "clerk_user_del",
    });

    const asUser = t.withIdentity({ subject: "clerk_user_del" });
    const user = await asUser.query(api.users.getMe);

    expect(user!.name).toBe("Former Team Member");
    expect(user!.email).toBe("");
    expect(user!.isAnonymized).toBe(true);
  });
});

describe("users.getMe", () => {
  it("returns null when not authenticated", async () => {
    const t = convexTest(schema, modules);
    const user = await t.query(api.users.getMe);
    expect(user).toBeNull();
  });

  it("returns null when user not synced yet", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "nonexistent_clerk_id" });
    const user = await asUser.query(api.users.getMe);
    expect(user).toBeNull();
  });
});
