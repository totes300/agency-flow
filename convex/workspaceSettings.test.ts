import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

describe("workspaceSettings.get", () => {
  it("returns null initially", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const settings = await asAdmin.query(api.workspaceSettings.get, {});
    expect(settings).toBeNull();
  });

  it("rejects team members", async () => {
    const t = convexTest(schema, modules);
    await setupAdmin(t);
    const asMember = await setupMember(t);

    await expect(
      asMember.query(api.workspaceSettings.get, {}),
    ).rejects.toThrow("Admin access required");
  });
});

describe("workspaceSettings.update", () => {
  it("creates settings on first call", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.workspaceSettings.update, {
      defaultHourlyRate: 120,
    });

    const settings = await asAdmin.query(api.workspaceSettings.get, {});
    expect(settings).not.toBeNull();
    expect(settings!.defaultHourlyRate).toBe(120);
  });

  it("patches existing settings", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.workspaceSettings.update, {
      defaultHourlyRate: 100,
    });
    await asAdmin.mutation(api.workspaceSettings.update, {
      defaultHourlyRate: 150,
    });

    const settings = await asAdmin.query(api.workspaceSettings.get, {});
    expect(settings!.defaultHourlyRate).toBe(150);
  });

  it("rejects negative rate", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await expect(
      asAdmin.mutation(api.workspaceSettings.update, {
        defaultHourlyRate: -10,
      }),
    ).rejects.toThrow("Default hourly rate cannot be negative");
  });

  it("rejects team members", async () => {
    const t = convexTest(schema, modules);
    await setupAdmin(t);
    const asMember = await setupMember(t);

    await expect(
      asMember.mutation(api.workspaceSettings.update, {
        defaultHourlyRate: 100,
      }),
    ).rejects.toThrow("Admin access required");
  });
});
