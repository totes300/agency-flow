import { convexTest } from "convex-test";
import { internal } from "./_generated/api";

export async function setupAdmin(t: ReturnType<typeof convexTest>) {
  await t.mutation(internal.users.upsertFromClerk, {
    data: {
      id: "admin_1",
      first_name: "Admin",
      last_name: "User",
      email_addresses: [
        { id: "email_1", email_address: "admin@test.com" },
      ],
      primary_email_address_id: "email_1",
      public_metadata: { role: "admin" },
    },
  });
  return t.withIdentity({ subject: "admin_1" });
}

export async function setupMember(t: ReturnType<typeof convexTest>) {
  await t.mutation(internal.users.upsertFromClerk, {
    data: {
      id: "member_1",
      first_name: "Team",
      last_name: "Member",
      email_addresses: [
        { id: "email_1", email_address: "member@test.com" },
      ],
      primary_email_address_id: "email_1",
      public_metadata: { role: "member" },
    },
  });
  return t.withIdentity({ subject: "member_1" });
}
