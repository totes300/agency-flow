import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

describe("workCategories.seed", () => {
  it("seeds default categories when none exist", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.workCategories.seed, {});
    const categories = await asAdmin.query(api.workCategories.list, {});

    expect(categories).toHaveLength(6);
    const names = categories.map((c) => c.name);
    expect(names).toContain("Design");
    expect(names).toContain("Development");
    expect(names).toContain("Copywriting");
    expect(names).toContain("Project Management");
    expect(names).toContain("Testing");
    expect(names).toContain("Wireframing");
  });

  it("does not seed if categories already exist", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.workCategories.seed, {});
    await asAdmin.mutation(api.workCategories.seed, {}); // second call
    const categories = await asAdmin.query(api.workCategories.list, {});

    expect(categories).toHaveLength(6); // still 6, not 12
  });

  it("rejects non-admin", async () => {
    const t = convexTest(schema, modules);
    const asMember = await setupMember(t);

    await expect(
      asMember.mutation(api.workCategories.seed, {}),
    ).rejects.toThrow("Admin access required");
  });
});

describe("workCategories.create", () => {
  it("creates a new category", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.workCategories.create, {
      name: "UX Research",
    });
    const categories = await asAdmin.query(api.workCategories.list, {});

    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe("UX Research");
    expect(categories[0].isArchived).toBe(false);
  });

  it("trims whitespace from name", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.workCategories.create, {
      name: "  Branding  ",
    });
    const categories = await asAdmin.query(api.workCategories.list, {});
    expect(categories[0].name).toBe("Branding");
  });

  it("rejects empty name", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await expect(
      asAdmin.mutation(api.workCategories.create, { name: "   " }),
    ).rejects.toThrow("Category name cannot be empty");
  });

  it("rejects duplicate name (case-insensitive)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.workCategories.create, { name: "Design" });
    await expect(
      asAdmin.mutation(api.workCategories.create, { name: "design" }),
    ).rejects.toThrow("A category with this name already exists");
  });

  it("rejects non-admin", async () => {
    const t = convexTest(schema, modules);
    const asMember = await setupMember(t);

    await expect(
      asMember.mutation(api.workCategories.create, { name: "Design" }),
    ).rejects.toThrow("Admin access required");
  });
});

describe("workCategories.rename", () => {
  it("renames a category", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const id = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });
    await asAdmin.mutation(api.workCategories.rename, {
      id,
      name: "Visual Design",
    });
    const categories = await asAdmin.query(api.workCategories.list, {});
    expect(categories[0].name).toBe("Visual Design");
  });

  it("rejects duplicate name on rename", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    await asAdmin.mutation(api.workCategories.create, { name: "Design" });
    const devId = await asAdmin.mutation(api.workCategories.create, {
      name: "Development",
    });

    await expect(
      asAdmin.mutation(api.workCategories.rename, {
        id: devId,
        name: "Design",
      }),
    ).rejects.toThrow("A category with this name already exists");
  });
});

describe("workCategories.archive", () => {
  it("archives a category (hidden from list but exists in listAll)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const id = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });
    await asAdmin.mutation(api.workCategories.archive, { id });

    const active = await asAdmin.query(api.workCategories.list, {});
    expect(active).toHaveLength(0);

    const all = await asAdmin.query(api.workCategories.listAll, {});
    expect(all).toHaveLength(1);
    expect(all[0].isArchived).toBe(true);
  });

  it("unarchives a category", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const id = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });
    await asAdmin.mutation(api.workCategories.archive, { id });
    await asAdmin.mutation(api.workCategories.unarchive, { id });

    const active = await asAdmin.query(api.workCategories.list, {});
    expect(active).toHaveLength(1);
    expect(active[0].isArchived).toBe(false);
  });
});

describe("workCategories.setDefaultUser", () => {
  it("sets a default user on a category", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });

    // Get the admin user ID
    const users = await asAdmin.query(api.users.listAll, {});
    const adminUser = users[0];

    await asAdmin.mutation(api.workCategories.setDefaultUser, {
      id: catId,
      userId: adminUser._id,
    });

    const categories = await asAdmin.query(api.workCategories.list, {});
    expect(categories[0].defaultUserId).toBe(adminUser._id);
    expect(categories[0].defaultUserName).toBe(adminUser.name);
  });

  it("clears the default user when userId is omitted", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });

    const users = await asAdmin.query(api.users.listAll, {});
    const adminUser = users[0];

    // Set then clear
    await asAdmin.mutation(api.workCategories.setDefaultUser, {
      id: catId,
      userId: adminUser._id,
    });
    await asAdmin.mutation(api.workCategories.setDefaultUser, {
      id: catId,
    });

    const categories = await asAdmin.query(api.workCategories.list, {});
    expect(categories[0].defaultUserId).toBeUndefined();
    expect(categories[0].defaultUserName).toBeNull();
  });

  it("rejects non-admin", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });

    await expect(
      asMember.mutation(api.workCategories.setDefaultUser, {
        id: catId,
      }),
    ).rejects.toThrow("Admin access required");
  });
});

describe("workCategories.setDefaultCostRate", () => {
  it("sets the default cost rate", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });
    await asAdmin.mutation(api.workCategories.setDefaultCostRate, {
      id: catId,
      rate: 50,
    });

    const categories = await asAdmin.query(api.workCategories.listAll, {});
    expect(categories[0].defaultCostRate).toBe(50);
  });

  it("clears when rate is omitted", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });
    await asAdmin.mutation(api.workCategories.setDefaultCostRate, {
      id: catId,
      rate: 50,
    });
    await asAdmin.mutation(api.workCategories.setDefaultCostRate, {
      id: catId,
    });

    const categories = await asAdmin.query(api.workCategories.listAll, {});
    expect(categories[0].defaultCostRate).toBeUndefined();
  });

  it("rejects negative rate", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });

    await expect(
      asAdmin.mutation(api.workCategories.setDefaultCostRate, {
        id: catId,
        rate: -10,
      }),
    ).rejects.toThrow("Cost rate cannot be negative");
  });

  it("rejects non-admin", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });

    await expect(
      asMember.mutation(api.workCategories.setDefaultCostRate, {
        id: catId,
        rate: 50,
      }),
    ).rejects.toThrow("Admin access required");
  });
});

describe("workCategories.setDefaultBillRate", () => {
  it("sets the default bill rate", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });
    await asAdmin.mutation(api.workCategories.setDefaultBillRate, {
      id: catId,
      rate: 100,
    });

    const categories = await asAdmin.query(api.workCategories.listAll, {});
    expect(categories[0].defaultBillRate).toBe(100);
  });

  it("clears when rate is omitted", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });
    await asAdmin.mutation(api.workCategories.setDefaultBillRate, {
      id: catId,
      rate: 100,
    });
    await asAdmin.mutation(api.workCategories.setDefaultBillRate, {
      id: catId,
    });

    const categories = await asAdmin.query(api.workCategories.listAll, {});
    expect(categories[0].defaultBillRate).toBeUndefined();
  });

  it("rejects negative rate", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });

    await expect(
      asAdmin.mutation(api.workCategories.setDefaultBillRate, {
        id: catId,
        rate: -10,
      }),
    ).rejects.toThrow("Bill rate cannot be negative");
  });

  it("does not affect the other rate field", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });
    await asAdmin.mutation(api.workCategories.setDefaultCostRate, {
      id: catId,
      rate: 50,
    });
    await asAdmin.mutation(api.workCategories.setDefaultBillRate, {
      id: catId,
      rate: 100,
    });

    const categories = await asAdmin.query(api.workCategories.listAll, {});
    expect(categories[0].defaultCostRate).toBe(50);
    expect(categories[0].defaultBillRate).toBe(100);
  });
});

describe("workCategories.list", () => {
  it("team member can list active categories", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    await asAdmin.mutation(api.workCategories.seed, {});
    const categories = await asMember.query(api.workCategories.list, {});
    expect(categories).toHaveLength(6);
  });

  it("team member cannot list all (including archived)", async () => {
    const t = convexTest(schema, modules);
    await setupAdmin(t);
    const asMember = await setupMember(t);

    await expect(
      asMember.query(api.workCategories.listAll, {}),
    ).rejects.toThrow("Admin access required");
  });

  it("list() does not expose default rate fields to team members", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const catId = await asAdmin.mutation(api.workCategories.create, {
      name: "Design",
    });
    await asAdmin.mutation(api.workCategories.setDefaultCostRate, {
      id: catId,
      rate: 50,
    });
    await asAdmin.mutation(api.workCategories.setDefaultBillRate, {
      id: catId,
      rate: 100,
    });

    const categories = await asMember.query(api.workCategories.list, {});
    expect(categories).toHaveLength(1);
    // Rate fields must NOT be present in the team member response
    expect("defaultCostRate" in categories[0]).toBe(false);
    expect("defaultBillRate" in categories[0]).toBe(false);
  });
});
