# Phase 4: Task Detail & Time Tracking — Implementation Guide

## Critical Context for the Implementing Agent

This is an internal agency tool. **Read CLAUDE.md in the repo root before starting** — it has hard constraints. Key rules:

- **Tech stack**: Next.js 16 (App Router), Convex (reactive DB), Clerk auth, shadcn/ui + Tailwind v4, Tiptap
- **No Next.js API routes** — ALL data through Convex functions
- **Durations are integer minutes** — never floats, never hours
- **Time entries chain: time → task → project → client** — no orphan time (#9)
- **Timer state is server-side** — `users` table stores `timerTaskId`/`timerStartedAt`
- **Rich text = Tiptap JSON** — not HTML/Markdown
- **Undo toast = 5-second delayed mutation** — use `hooks/use-undo-action.ts`
- **All lists use cursor-based pagination** — 50 records default
- **shadcn/ui components only** — search shadcn MCP server first, never hand-roll UI
- **Team members see only assigned tasks** — enforce at function level
- **Completing subtasks does NOT auto-complete parent** (#8)
- **Subtask reorder = up/down arrows** (DnD deferred to Phase 5)
- **Duration preset chips REPLACE** (not accumulate)

### Key Existing Files

| File | Purpose |
|------|---------|
| `convex/schema.ts` | All tables defined upfront |
| `convex/tasks.ts` | Task CRUD, bulk actions |
| `convex/users.ts` | User queries (getMe, listAll), Clerk webhook handlers |
| `convex/lib/permissions.ts` | `requireAuth`, `requireAdmin`, `isAdmin`, `getCurrentUser` |
| `convex/test_helpers.test.ts` | `setupAdmin(t)`, `setupMember(t)` helpers |
| `lib/format.ts` | `formatDuration`, `formatCurrency`, `formatDate`, `formatDistanceToNow` |
| `hooks/use-undo-action.ts` | 5-second delayed mutation with undo toast |
| `hooks/use-mobile.ts` | `useIsMobile()` hook (breakpoint 768px) |
| `app/(dashboard)/layout.tsx` | Dashboard shell with sidebar, header, search |
| `app/(dashboard)/tasks/page.tsx` | Task list page with filters, pagination |
| `components/task-list-table.tsx` | Desktop table + mobile cards, inline editors, bulk actions |
| `components/task-status-select.tsx` | Inline status selector + badge |
| `components/task-project-selector.tsx` | Inline project picker |
| `components/task-assignee-picker.tsx` | Inline assignee multi-select + avatars |
| `components/task-category-select.tsx` | Inline work category picker |
| `components/task-actions-menu.tsx` | Dropdown with duplicate/archive/delete |
| `components/task-indicators.tsx` | Description/subtask/comment indicator icons |
| `components/task-bulk-bar.tsx` | Floating bulk action bar |

### Testing Pattern

All Convex tests use `convex-test` + `vitest`:
```ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";
const modules = import.meta.glob("./**/*.ts");
```

Helper for tests needing a project:
```ts
async function setupClientProject(asAdmin: any) {
  const clientId = await asAdmin.mutation(api.clients.create, { name: "Test Client", currency: "USD" });
  const projectId = await asAdmin.mutation(api.projects.create, { clientId, name: "Test Project", billingType: "fixed" });
  return { clientId, projectId };
}
```

---

## Dependency Graph

```
Session 1: Schema + Time Entries + Activity Log Backend
    |
    ├──> Session 2: Timer Backend + Global Indicator UI
    |         |
    ├──> Session 3: Attachments + Comments Backend
    |         |
    ├─────────┴──> Session 4: Task Detail Dialog Shell + Subtasks
    |                   |
    └───────────────────┴──> Session 5: Tiptap + Add Time + Comments UI + Attachments UI
                                  |
                                  └──> Session 6: Time Entry List + Activity Tab + Polish
```

---

## Session 1: Schema + Time Entries + Activity Log Backend

**Dependencies:** None
**Commit:** `feat(phase-4): time entries CRUD, activity log backend, schema update (4.5–4.7)`

### 1.1 Schema Changes (`convex/schema.ts`)

**DONE** ✅ — Already applied:
- Added `uploadedBy: v.id("users")` to `attachments` table
- Added `sortOrder: v.optional(v.number())` to `tasks` table

### 1.2 New File: `convex/activityLog.ts`

**DONE** ✅ — Already created. Read the file to verify it has:
- `list` query: paginated, newest first, enriched with userName/avatarUrl, permission-scoped (member must be assigned)
- `log` internalMutation: inserts into activityLogEntries table

### 1.3 New File: `convex/timeEntries.ts`

**DONE** ✅ — Already created. Read the file to verify it has:
- `list` query: paginated, newest first, enriched with userName/avatarUrl, permission-scoped
- `create` mutation: validates task has project (#9), durationMinutes > 0 integer, YYYY-MM-DD date, method="manual", logs activity
- `update` mutation: own or admin, validates same, logs "edited time entry: Xm → Ym"
- `remove` mutation: own or admin, logs "deleted Xm time entry"

### 1.4 Modify: `convex/tasks.ts` — Add activity log calls

Add `import { internal } from "./_generated/api"` at top (it's not imported yet).

Then add `ctx.runMutation(internal.activityLog.log, {...})` calls to these mutations:

**`create`** — After `const taskId = await ctx.db.insert(...)`, before `return`:
```ts
const user = await requireAuth(ctx); // already exists at top of handler
// ... existing code ...
const taskId = await ctx.db.insert("tasks", { ... });

await ctx.runMutation(internal.activityLog.log, {
  taskId,
  userId: user._id,
  action: "created task",
});

return taskId;
```

Note: `create` currently doesn't store `user` — you need to capture the return value of `requireAuth(ctx)` which is already called at the top. Actually looking at the code, `create` calls `await requireAuth(ctx)` but doesn't save it. Change to `const user = await requireAuth(ctx)`.

**`updateStatus`** — After `await ctx.db.patch(id, { status })`:
```ts
await ctx.runMutation(internal.activityLog.log, {
  taskId: id,
  userId: user._id,
  action: `changed status ${task.status} → ${status}`,
});
```

**`update`** — After `await ctx.db.patch(id, patch)`:
```ts
if (patch.assigneeIds) {
  await ctx.runMutation(internal.activityLog.log, {
    taskId: id,
    userId: user._id,
    action: "updated assignees",
  });
}
if (patch.projectId !== undefined) {
  await ctx.runMutation(internal.activityLog.log, {
    taskId: id,
    userId: user._id,
    action: "changed project",
  });
}
```

**`archive`** — After `await ctx.db.patch(id, { isArchived: true })`:
```ts
await ctx.runMutation(internal.activityLog.log, {
  taskId: id,
  userId: user._id,
  action: "archived task",
});
```

### 1.5 Tests

Write these two test files with full code:

**`convex/timeEntries.test.ts`** — 11 tests. Full code:

```ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

async function setupClientProject(asAdmin: any) {
  const clientId = await asAdmin.mutation(api.clients.create, { name: "Test Client", currency: "USD" });
  const projectId = await asAdmin.mutation(api.projects.create, { clientId, name: "Test Project", billingType: "fixed" });
  return { clientId, projectId };
}

describe("timeEntries.create", () => {
  it("creates with correct fields, method=manual", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const entryId = await asAdmin.mutation(api.timeEntries.create, {
      taskId, durationMinutes: 60, date: "2025-06-15",
    });

    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].durationMinutes).toBe(60);
    expect(result.page[0].method).toBe("manual");
  });

  it("blocked on task without project", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "No Project Task" });

    await expect(
      asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" }),
    ).rejects.toThrow("Task must have a project");
  });

  it("member logs on assigned task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );
    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task", projectId, assigneeIds: [memberUser!._id],
    });

    await asMember.mutation(api.timeEntries.create, { taskId, durationMinutes: 45, date: "2025-06-15" });
    const result = await asMember.query(api.timeEntries.list, { taskId });
    expect(result.page).toHaveLength(1);
  });

  it("member blocked on unassigned task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await expect(
      asMember.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" }),
    ).rejects.toThrow("Access denied");
  });
});

describe("timeEntries.list", () => {
  it("newest first, paginated", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-14" });
    await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 60, date: "2025-06-15" });

    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page).toHaveLength(2);
    expect(result.page[0].durationMinutes).toBe(60);
    expect(result.page[1].durationMinutes).toBe(30);
  });
});

describe("timeEntries.update", () => {
  it("owner edits own", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const entryId = await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await asAdmin.mutation(api.timeEntries.update, { id: entryId, durationMinutes: 45 });

    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page[0].durationMinutes).toBe(45);
  });

  it("admin edits any", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );
    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task", projectId, assigneeIds: [memberUser!._id],
    });
    const entryId = await asMember.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await asAdmin.mutation(api.timeEntries.update, { id: entryId, durationMinutes: 60 });
    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page[0].durationMinutes).toBe(60);
  });

  it("member blocked on others'", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );
    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task", projectId, assigneeIds: [memberUser!._id],
    });
    const entryId = await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await expect(
      asMember.mutation(api.timeEntries.update, { id: entryId, durationMinutes: 60 }),
    ).rejects.toThrow("Access denied");
  });
});

describe("timeEntries.remove", () => {
  it("owner deletes own", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const entryId = await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await asAdmin.mutation(api.timeEntries.remove, { id: entryId });
    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page).toHaveLength(0);
  });

  it("admin deletes any", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );
    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task", projectId, assigneeIds: [memberUser!._id],
    });
    const entryId = await asMember.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await asAdmin.mutation(api.timeEntries.remove, { id: entryId });
    const result = await asAdmin.query(api.timeEntries.list, { taskId });
    expect(result.page).toHaveLength(0);
  });

  it("member blocked on others'", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );
    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task", projectId, assigneeIds: [memberUser!._id],
    });
    const entryId = await asAdmin.mutation(api.timeEntries.create, { taskId, durationMinutes: 30, date: "2025-06-15" });

    await expect(
      asMember.mutation(api.timeEntries.remove, { id: entryId }),
    ).rejects.toThrow("Access denied");
  });
});
```

**`convex/activityLog.test.ts`** — 3 tests. Full code:

```ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

describe("activityLog.log", () => {
  it("creates entry with correct fields", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });

    const adminUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique()
    );

    await t.mutation(internal.activityLog.log, {
      taskId,
      userId: adminUser!._id,
      action: "test action",
      metadata: { key: "value" },
    });

    const result = await asAdmin.query(api.activityLog.list, { taskId });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].action).toBe("test action");
    expect(result.page[0].metadata).toEqual({ key: "value" });
    expect(result.page[0].userName).toBe("Admin User");
  });
});

describe("activityLog.list", () => {
  it("newest first, paginated", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });

    const adminUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique()
    );

    await t.mutation(internal.activityLog.log, { taskId, userId: adminUser!._id, action: "first" });
    await t.mutation(internal.activityLog.log, { taskId, userId: adminUser!._id, action: "second" });

    const result = await asAdmin.query(api.activityLog.list, { taskId });
    expect(result.page).toHaveLength(2);
    expect(result.page[0].action).toBe("second");
    expect(result.page[1].action).toBe("first");
  });

  it("member scoped to assigned tasks", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);

    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Unassigned Task" });

    await expect(
      asMember.query(api.activityLog.list, { taskId }),
    ).rejects.toThrow("Access denied");
  });
});
```

### 1.6 Verify

```bash
npx vitest convex/timeEntries.test.ts convex/activityLog.test.ts
```

### 1.7 Commit

```bash
git add convex/schema.ts convex/activityLog.ts convex/timeEntries.ts convex/tasks.ts convex/timeEntries.test.ts convex/activityLog.test.ts
git commit -m "feat(phase-4): time entries CRUD, activity log backend, schema update (4.5–4.7)"
```

---

## Session 2: Timer Backend + Global Indicator UI

**Dependencies:** Session 1 (uses `internal.activityLog.log`)
**Commit:** `feat(phase-4): timer start/stop backend + global indicator UI (4.4)`

### 2.1 New File: `convex/timer.ts`

Full code — copy verbatim:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, isAdmin } from "./lib/permissions";

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (!user.timerTaskId || !user.timerStartedAt) {
      return { isRunning: false as const };
    }

    const task = await ctx.db.get(user.timerTaskId);
    let projectName: string | null = null;
    if (task?.projectId) {
      const project = await ctx.db.get(task.projectId);
      projectName = project?.name ?? null;
    }

    return {
      isRunning: true as const,
      taskId: user.timerTaskId,
      taskTitle: task?.title ?? "Unknown Task",
      projectName,
      startedAt: user.timerStartedAt,
    };
  },
});

export const start = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const user = await requireAuth(ctx);

    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    if (!task.projectId) {
      throw new Error("Task must have a project before starting timer");
    }

    // No-op if same task already running
    if (user.timerTaskId === taskId) {
      return { previousTaskTitle: undefined, previousElapsedMinutes: undefined };
    }

    // Auto-stop previous timer
    let previousTaskTitle: string | undefined;
    let previousElapsedMinutes: number | undefined;

    if (user.timerTaskId && user.timerStartedAt) {
      const prevTask = await ctx.db.get(user.timerTaskId);
      previousTaskTitle = prevTask?.title;

      const now = Date.now();
      const elapsedMs = now - user.timerStartedAt;
      const elapsedMinutes = Math.ceil(elapsedMs / 60000);
      previousElapsedMinutes = elapsedMinutes;

      if (elapsedMinutes > 0) {
        const today = new Date(now);
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        await ctx.db.insert("timeEntries", {
          taskId: user.timerTaskId,
          userId: user._id,
          date: dateStr,
          durationMinutes: elapsedMinutes,
          method: "timer",
        });

        await ctx.runMutation(internal.activityLog.log, {
          taskId: user.timerTaskId,
          userId: user._id,
          action: `stopped timer (${elapsedMinutes}m)`,
        });
      }
    }

    // Start new timer
    await ctx.db.patch(user._id, {
      timerTaskId: taskId,
      timerStartedAt: Date.now(),
    });

    await ctx.runMutation(internal.activityLog.log, {
      taskId,
      userId: user._id,
      action: "started timer",
    });

    return { previousTaskTitle, previousElapsedMinutes };
  },
});

export const stop = mutation({
  args: { saveIfUnderOneMinute: v.optional(v.boolean()) },
  handler: async (ctx, { saveIfUnderOneMinute }) => {
    const user = await requireAuth(ctx);

    if (!user.timerTaskId || !user.timerStartedAt) {
      throw new Error("No timer running");
    }

    const now = Date.now();
    const elapsedMs = now - user.timerStartedAt;
    const elapsedMinutes = Math.ceil(elapsedMs / 60000);

    const taskId = user.timerTaskId;
    const task = await ctx.db.get(taskId);
    const taskTitle = task?.title ?? "Unknown Task";

    // Clear timer
    await ctx.db.patch(user._id, {
      timerTaskId: undefined,
      timerStartedAt: undefined,
    });

    // Sub-minute: return 0 so UI can offer save/discard
    if (elapsedMs < 60000 && !saveIfUnderOneMinute) {
      return { durationMinutes: 0, taskTitle };
    }

    // Create time entry (uses server timestamp per constraint #4)
    const today = new Date(now);
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await ctx.db.insert("timeEntries", {
      taskId,
      userId: user._id,
      date: dateStr,
      durationMinutes: elapsedMinutes,
      method: "timer",
    });

    await ctx.runMutation(internal.activityLog.log, {
      taskId,
      userId: user._id,
      action: `stopped timer (${elapsedMinutes}m)`,
    });

    return { durationMinutes: elapsedMinutes, taskTitle };
  },
});

export const discard = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (!user.timerTaskId) {
      throw new Error("No timer running");
    }

    await ctx.db.patch(user._id, {
      timerTaskId: undefined,
      timerStartedAt: undefined,
    });
  },
});
```

### 2.2 New File: `components/timer-indicator.tsx`

Full code — copy verbatim:

```tsx
"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Square, Clock } from "lucide-react"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"

export function TimerIndicator() {
  const status = useQuery(api.timer.getStatus)
  const stopTimer = useMutation(api.timer.stop)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const [elapsed, setElapsed] = useState("")

  useEffect(() => {
    if (!status?.isRunning || !status.startedAt) {
      setElapsed("")
      return
    }

    const update = () => {
      const diff = Math.max(0, Date.now() - status.startedAt!)
      const totalSeconds = Math.floor(diff / 1000)
      const h = Math.floor(totalSeconds / 3600)
      const m = Math.floor((totalSeconds % 3600) / 60)
      const s = totalSeconds % 60
      if (h > 0) {
        setElapsed(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`)
      } else {
        setElapsed(`${m}:${String(s).padStart(2, "0")}`)
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [status?.isRunning, status?.startedAt])

  const handleStop = useCallback(async () => {
    try {
      const result = await stopTimer({})
      if (result.durationMinutes === 0) {
        toast("Timer was under 1 minute", {
          action: {
            label: "Save as 1m",
            onClick: async () => {
              try { await stopTimer({ saveIfUnderOneMinute: true }) } catch {}
            },
          },
        })
      }
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }, [stopTimer])

  const handleTaskClick = useCallback(() => {
    if (!status?.isRunning || !status.taskId) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("task", status.taskId)
    router.push(`/tasks?${params.toString()}`)
  }, [status, router, searchParams])

  if (!status?.isRunning) return null

  // Mobile: fixed bottom bar
  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2">
        <div className="flex items-center gap-3">
          <Clock className="size-4 text-primary shrink-0 animate-pulse" />
          <button onClick={handleTaskClick} className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">{status.taskTitle}</p>
            {status.projectName && (
              <p className="text-xs text-muted-foreground truncate">{status.projectName}</p>
            )}
          </button>
          <span className="font-mono text-sm tabular-nums shrink-0">{elapsed}</span>
          <Button size="sm" variant="destructive" onClick={handleStop}>
            <Square className="size-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  // Desktop: inline in header
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
      <Clock className="size-3.5 text-primary animate-pulse" />
      <button onClick={handleTaskClick} className="max-w-[160px] truncate text-left hover:underline">
        {status.taskTitle}
      </button>
      <span className="font-mono tabular-nums text-muted-foreground">{elapsed}</span>
      <Button size="icon" variant="ghost" className="size-6" onClick={handleStop}>
        <Square className="size-3" />
      </Button>
    </div>
  )
}
```

### 2.3 Modify: `app/(dashboard)/layout.tsx`

Add import: `import { TimerIndicator } from "@/components/timer-indicator"`

Replace:
```tsx
{/* Timer indicator placeholder — wired in Phase 4 */}
<div id="timer-indicator" />
```
With:
```tsx
<TimerIndicator />
```

### 2.4 Tests: `convex/timer.test.ts` — 9 tests

Full code — copy verbatim:

```ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

async function setupClientProject(asAdmin: any) {
  const clientId = await asAdmin.mutation(api.clients.create, { name: "Test Client", currency: "USD" });
  const projectId = await asAdmin.mutation(api.projects.create, { clientId, name: "Test Project", billingType: "fixed" });
  return { clientId, projectId };
}

describe("timer.start", () => {
  it("sets timerTaskId + timerStartedAt", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await asAdmin.mutation(api.timer.start, { taskId });

    const status = await asAdmin.query(api.timer.getStatus, {});
    expect(status.isRunning).toBe(true);
    expect(status.taskId).toBe(taskId);
    expect(status.taskTitle).toBe("Task");
  });

  it("blocked without project", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "No Project" });

    await expect(asAdmin.mutation(api.timer.start, { taskId })).rejects.toThrow("Task must have a project");
  });

  it("auto-stops previous, returns previous info", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const task1 = await asAdmin.mutation(api.tasks.create, { title: "Task 1", projectId });
    const task2 = await asAdmin.mutation(api.tasks.create, { title: "Task 2", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: task1, timerStartedAt: Date.now() - 5 * 60 * 1000 });
    });

    const result = await asAdmin.mutation(api.timer.start, { taskId: task2 });
    expect(result.previousTaskTitle).toBe("Task 1");
    expect(result.previousElapsedMinutes).toBeGreaterThanOrEqual(5);

    const status = await asAdmin.query(api.timer.getStatus, {});
    expect(status.taskId).toBe(task2);
  });

  it("no-op on same task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await asAdmin.mutation(api.timer.start, { taskId });
    const result = await asAdmin.mutation(api.timer.start, { taskId });
    expect(result.previousTaskTitle).toBeUndefined();
  });

  it("member blocked on unassigned task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await expect(asMember.mutation(api.timer.start, { taskId })).rejects.toThrow("Access denied");
  });
});

describe("timer.stop", () => {
  it("creates time entry with correct duration/date", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 5 * 60 * 1000 });
    });

    const result = await asAdmin.mutation(api.timer.stop, {});
    expect(result.durationMinutes).toBeGreaterThanOrEqual(5);
    expect(result.taskTitle).toBe("Task");

    const entries = await t.run(async (ctx) => ctx.db.query("timeEntries").collect());
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].method).toBe("timer");
  });

  it("returns durationMinutes=0 for sub-minute", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 10 * 1000 });
    });

    const result = await asAdmin.mutation(api.timer.stop, {});
    expect(result.durationMinutes).toBe(0);
  });

  it("saveIfUnderOneMinute=true creates 1m entry", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 30 * 1000 });
    });

    const result = await asAdmin.mutation(api.timer.stop, { saveIfUnderOneMinute: true });
    expect(result.durationMinutes).toBe(1);
  });
});

describe("timer.discard", () => {
  it("clears timer, no entry", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.patch(user!._id, { timerTaskId: taskId, timerStartedAt: Date.now() - 3 * 60 * 1000 });
    });

    await asAdmin.mutation(api.timer.discard, {});

    const status = await asAdmin.query(api.timer.getStatus, {});
    expect(status.isRunning).toBe(false);

    const entries = await t.run(async (ctx) => ctx.db.query("timeEntries").collect());
    expect(entries).toHaveLength(0);
  });
});
```

### 2.5 Commit

```bash
git add convex/timer.ts convex/timer.test.ts components/timer-indicator.tsx app/\(dashboard\)/layout.tsx
git commit -m "feat(phase-4): timer start/stop backend + global indicator UI (4.4)"
```

---

## Session 3: Attachments + Comments Backend

**Dependencies:** Session 1 (uses `internal.activityLog.log`)
**Commit:** `feat(phase-4): attachments + comments backend with @mention notifications (4.3, 4.8)`

### 3.1 New File: `convex/attachments.ts`

Full code — copy verbatim:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, isAdmin } from "./lib/permissions";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_TASK = 20;
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"];
const ALLOWED_MIME_EXACT = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
];

function isAllowedMime(mimeType: string): boolean {
  if (ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) return true;
  if (ALLOWED_MIME_EXACT.includes(mimeType)) return true;
  return false;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, { taskId, storageId, fileName, mimeType, size }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    if (size > MAX_FILE_SIZE) throw new Error("File exceeds 10 MB limit");
    if (!isAllowedMime(mimeType)) throw new Error("File type not allowed");

    const existing = await ctx.db.query("attachments")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId)).collect();
    if (existing.length >= MAX_FILES_PER_TASK) throw new Error("Maximum 20 files per task");

    const id = await ctx.db.insert("attachments", {
      taskId, storageId, fileName, mimeType, size, uploadedBy: user._id,
    });

    await ctx.runMutation(internal.activityLog.log, {
      taskId, userId: user._id, action: `uploaded ${fileName}`,
    });

    return id;
  },
});

export const list = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }

    const attachments = await ctx.db.query("attachments")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId)).collect();

    const userMap = new Map<string, string>();
    const allUsers = await ctx.db.query("users").collect();
    for (const u of allUsers) userMap.set(u._id, u.name);

    return Promise.all(
      attachments.map(async (a) => ({
        ...a,
        uploaderName: userMap.get(a.uploadedBy) ?? "Unknown",
        url: await ctx.storage.getUrl(a.storageId),
      })),
    );
  },
});

export const remove = mutation({
  args: { id: v.id("attachments") },
  handler: async (ctx, { id }) => {
    const user = await requireAuth(ctx);
    const attachment = await ctx.db.get(id);
    if (!attachment) throw new Error("Attachment not found");
    if (attachment.uploadedBy !== user._id && !isAdmin(user)) {
      throw new Error("Access denied");
    }

    await ctx.runMutation(internal.activityLog.log, {
      taskId: attachment.taskId, userId: user._id, action: `deleted ${attachment.fileName}`,
    });

    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(id);
  },
});
```

### 3.2 New File: `convex/comments.ts`

Full code — copy verbatim:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, isAdmin } from "./lib/permissions";

export const list = query({
  args: {
    taskId: v.id("tasks"),
    paginationOpts: v.optional(v.object({
      cursor: v.optional(v.string()),
      numItems: v.optional(v.number()),
    })),
  },
  handler: async (ctx, { taskId, paginationOpts }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) throw new Error("Access denied");

    const numItems = paginationOpts?.numItems ?? 50;
    let comments = await ctx.db.query("comments")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId)).collect();
    comments.sort((a, b) => b._creationTime - a._creationTime);

    const cursorTime = paginationOpts?.cursor ? parseFloat(paginationOpts.cursor) : Infinity;
    const afterCursor = comments.filter((c) => c._creationTime < cursorTime);
    const page = afterCursor.slice(0, numItems);
    const hasMore = afterCursor.length > numItems;
    const nextCursor = page.length > 0 ? String(page[page.length - 1]._creationTime) : undefined;

    const userMap = new Map<string, { name: string; avatarUrl?: string }>();
    const allUsers = await ctx.db.query("users").collect();
    for (const u of allUsers) userMap.set(u._id, { name: u.name, avatarUrl: u.avatarUrl });

    return {
      page: page.map((c) => {
        const cu = userMap.get(c.userId);
        return { ...c, userName: cu?.name ?? "Unknown", userAvatarUrl: cu?.avatarUrl };
      }),
      continueCursor: nextCursor ?? "",
      isDone: !hasMore,
    };
  },
});

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    content: v.any(),
    mentionedUserIds: v.array(v.id("users")),
  },
  handler: async (ctx, { taskId, content, mentionedUserIds }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) throw new Error("Access denied");

    const commentId = await ctx.db.insert("comments", {
      taskId, userId: user._id, content, mentionedUserIds,
    });

    for (const mentionedId of mentionedUserIds) {
      if (mentionedId === user._id) continue;
      await ctx.db.insert("notifications", {
        userId: mentionedId,
        type: "mention",
        relatedEntityId: taskId,
        relatedEntityType: "task",
        message: `${user.name} mentioned you in a comment on "${task.title}"`,
        isRead: false,
      });
    }

    await ctx.runMutation(internal.activityLog.log, {
      taskId, userId: user._id, action: "added a comment",
    });

    return commentId;
  },
});

export const remove = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, { id }) => {
    const user = await requireAuth(ctx);
    const comment = await ctx.db.get(id);
    if (!comment) throw new Error("Comment not found");
    if (comment.userId !== user._id && !isAdmin(user)) throw new Error("Access denied");

    await ctx.runMutation(internal.activityLog.log, {
      taskId: comment.taskId, userId: user._id, action: "deleted a comment",
    });

    await ctx.db.delete(id);
  },
});
```

### 3.3 Tests: `convex/attachments.test.ts` — 7 tests

Full code — copy verbatim:

```ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

async function setupClientProject(asAdmin: any) {
  const clientId = await asAdmin.mutation(api.clients.create, { name: "Test Client", currency: "USD" });
  const projectId = await asAdmin.mutation(api.projects.create, { clientId, name: "Test Project", billingType: "fixed" });
  return { clientId, projectId };
}

describe("attachments.create", () => {
  it("inserts with uploadedBy", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    // We can't easily test with real storage in convex-test, so insert a fake storageId
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    const id = await asAdmin.mutation(api.attachments.create, {
      taskId, storageId, fileName: "test.pdf", mimeType: "application/pdf", size: 1000,
    });

    const list = await asAdmin.query(api.attachments.list, { taskId });
    expect(list).toHaveLength(1);
    expect(list[0].fileName).toBe("test.pdf");
    expect(list[0].uploaderName).toBe("Admin User");
  });

  it("rejects >10MB", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    await expect(
      asAdmin.mutation(api.attachments.create, {
        taskId, storageId, fileName: "big.pdf", mimeType: "application/pdf", size: 11 * 1024 * 1024,
      }),
    ).rejects.toThrow("File exceeds 10 MB limit");
  });

  it("rejects disallowed MIME", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    await expect(
      asAdmin.mutation(api.attachments.create, {
        taskId, storageId, fileName: "evil.exe", mimeType: "application/x-executable", size: 1000,
      }),
    ).rejects.toThrow("File type not allowed");
  });

  it("rejects 21st file", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    // Insert 20 attachments directly
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      const sid = await ctx.storage.store(new Blob(["x"]));
      for (let i = 0; i < 20; i++) {
        await ctx.db.insert("attachments", {
          taskId, storageId: sid, fileName: `file${i}.pdf`, mimeType: "application/pdf", size: 100, uploadedBy: user!._id,
        });
      }
    });

    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));
    await expect(
      asAdmin.mutation(api.attachments.create, {
        taskId, storageId, fileName: "21st.pdf", mimeType: "application/pdf", size: 100,
      }),
    ).rejects.toThrow("Maximum 20 files per task");
  });
});

describe("attachments.list", () => {
  it("returns with uploader name", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    await asAdmin.mutation(api.attachments.create, {
      taskId, storageId, fileName: "doc.pdf", mimeType: "application/pdf", size: 500,
    });

    const list = await asAdmin.query(api.attachments.list, { taskId });
    expect(list).toHaveLength(1);
    expect(list[0].uploaderName).toBe("Admin User");
    expect(list[0].url).toBeTruthy();
  });
});

describe("attachments.remove", () => {
  it("uploader deletes own", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    const id = await asAdmin.mutation(api.attachments.create, {
      taskId, storageId, fileName: "doc.pdf", mimeType: "application/pdf", size: 500,
    });

    await asAdmin.mutation(api.attachments.remove, { id });
    const list = await asAdmin.query(api.attachments.list, { taskId });
    expect(list).toHaveLength(0);
  });

  it("admin deletes any; member blocked", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );
    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task", projectId, assigneeIds: [memberUser!._id],
    });
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["test"])));

    // Admin uploads
    const id = await asAdmin.mutation(api.attachments.create, {
      taskId, storageId, fileName: "admin.pdf", mimeType: "application/pdf", size: 500,
    });

    // Member can't delete admin's file
    await expect(asMember.mutation(api.attachments.remove, { id })).rejects.toThrow("Access denied");

    // Admin can delete
    await asAdmin.mutation(api.attachments.remove, { id });
    const list = await asAdmin.query(api.attachments.list, { taskId });
    expect(list).toHaveLength(0);
  });
});
```

### 3.4 Tests: `convex/comments.test.ts` — 7 tests

Full code — copy verbatim:

```ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { setupAdmin, setupMember } from "./test_helpers.test";

const modules = import.meta.glob("./**/*.ts");

async function setupClientProject(asAdmin: any) {
  const clientId = await asAdmin.mutation(api.clients.create, { name: "Test Client", currency: "USD" });
  const projectId = await asAdmin.mutation(api.projects.create, { clientId, name: "Test Project", billingType: "fixed" });
  return { clientId, projectId };
}

describe("comments.create", () => {
  it("inserts correctly", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };
    const id = await asAdmin.mutation(api.comments.create, { taskId, content, mentionedUserIds: [] });

    const result = await asAdmin.query(api.comments.list, { taskId });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].userName).toBe("Admin User");
  });

  it("writes notification for mentions", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );
    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task", projectId, assigneeIds: [memberUser!._id],
    });

    const content = { type: "doc", content: [] };
    await asAdmin.mutation(api.comments.create, {
      taskId, content, mentionedUserIds: [memberUser!._id],
    });

    const notifications = await t.run(async (ctx) =>
      ctx.db.query("notifications").withIndex("by_userId", (q) => q.eq("userId", memberUser!._id)).collect()
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("mention");
    expect(notifications[0].isRead).toBe(false);
  });

  it("no self-mention notification", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const adminUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique()
    );

    await asAdmin.mutation(api.comments.create, {
      taskId, content: { type: "doc", content: [] }, mentionedUserIds: [adminUser!._id],
    });

    const notifications = await t.run(async (ctx) => ctx.db.query("notifications").collect());
    expect(notifications).toHaveLength(0);
  });
});

describe("comments.list", () => {
  it("newest first, paginated", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    await asAdmin.mutation(api.comments.create, {
      taskId, content: { text: "first" }, mentionedUserIds: [],
    });
    await asAdmin.mutation(api.comments.create, {
      taskId, content: { text: "second" }, mentionedUserIds: [],
    });

    const result = await asAdmin.query(api.comments.list, { taskId });
    expect(result.page).toHaveLength(2);
    // Newest first — second was created after first
    expect(result.page[0].content).toEqual({ text: "second" });
  });
});

describe("comments.remove", () => {
  it("author deletes own", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task", projectId });

    const id = await asAdmin.mutation(api.comments.create, {
      taskId, content: { type: "doc", content: [] }, mentionedUserIds: [],
    });
    await asAdmin.mutation(api.comments.remove, { id });
    const result = await asAdmin.query(api.comments.list, { taskId });
    expect(result.page).toHaveLength(0);
  });

  it("admin deletes any", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );
    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task", projectId, assigneeIds: [memberUser!._id],
    });

    const id = await asMember.mutation(api.comments.create, {
      taskId, content: { type: "doc", content: [] }, mentionedUserIds: [],
    });

    // Admin can delete member's comment
    await asAdmin.mutation(api.comments.remove, { id });
    const result = await asAdmin.query(api.comments.list, { taskId });
    expect(result.page).toHaveLength(0);
  });

  it("other member blocked", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const { projectId } = await setupClientProject(asAdmin);
    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );
    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task", projectId, assigneeIds: [memberUser!._id],
    });

    // Admin creates comment
    const id = await asAdmin.mutation(api.comments.create, {
      taskId, content: { type: "doc", content: [] }, mentionedUserIds: [],
    });

    // Member can't delete admin's comment
    await expect(asMember.mutation(api.comments.remove, { id })).rejects.toThrow("Access denied");
  });
});
```

### 3.5 Commit

```bash
git add convex/attachments.ts convex/comments.ts convex/attachments.test.ts convex/comments.test.ts
git commit -m "feat(phase-4): attachments + comments backend with @mention notifications (4.3, 4.8)"
```

---

## Session 4: Task Detail Dialog Shell + Subtasks

**Dependencies:** Sessions 1–3
**Commit:** `feat(phase-4): task detail dialog with metadata editors + subtasks (4.1, 4.2)`

### Target UI — Desktop Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ✕ Close                                                        │
├────────────────────────────────┬────────────────────────────────┤
│  LEFT COLUMN (scrollable)     │  RIGHT SIDEBAR (scrollable)    │
│                                │                                │
│  [▶ Timer] Task Title (edit)   │  Status    [● Today    ▾]     │
│  ─────────────────────────     │  Assignees [👤 👤       ▾]     │
│  Description (Tiptap)          │  Project   [Client > Proj ▾]  │
│  [B I S H₁ H₂ • - ☐ ── ]     │  Category  [Development  ▾]   │
│  Rich text content here...     │  Billable  [✓ toggle]         │
│                                │  Estimate  [2h 30m     ]      │
│  ─────────────────────────     │  ──────────────────────────── │
│  Subtasks (3/5 done)           │  Time: 4h 30m / 8h est       │
│  ☑ Design mockups     ↑↓      │  ████████░░░░░  56%           │
│  ☐ Build frontend     ↑↓      │  ──────────────────────────── │
│  ☐ Write tests        ↑↓      │  [Activity] [Comments]        │
│  + Add subtask...              │                                │
│  ─────────────────────────     │  • John changed status        │
│  Files (2/20)                  │    inbox → today  · 2h ago    │
│  📎 mockup.png  1.2MB  ✕      │  • Jane added a comment       │
│  📎 brief.pdf   340KB  ✕      │    · 3h ago                   │
│  [+ Upload files]              │  • John started timer         │
│  ─────────────────────────     │    · 5h ago                   │
│  Time Tracking                 │  [Load more...]               │
│  [Add Time form]               │                                │
│  ─────────────────────────     │                                │
│  Time Entries                  │                                │
│  2h · Today · John · "API"  ✏✕│                                │
│  1h · Yesterday · Jane     ✏✕ │                                │
│  [Load more...]                │                                │
└────────────────────────────────┴────────────────────────────────┘
```

### Target UI — Mobile Layout (full-screen Sheet)

```
┌───────────────────────┐
│ ← Back                │
│                       │
│ [▶] Task Title        │
│ ──────────────────    │
│ Status  [Today ▾]     │
│ Assign  [👤 👤  ▾]    │
│ Project [Proj   ▾]    │
│ Category [Dev   ▾]    │
│ Billable [✓]  Est [2h]│
│ Time: 4h30m / 8h      │
│ ████████░░░  56%       │
│ ──────────────────    │
│ Description            │
│ Rich text here...      │
│ ──────────────────    │
│ Subtasks (3/5)         │
│ ☑ Design   ☐ Build    │
│ + Add subtask...       │
│ ──────────────────    │
│ Files (2/20)           │
│ ──────────────────    │
│ [Add Time]             │
│ Time Entries           │
│ ──────────────────    │
│ [Activity] [Comments]  │
│                       │
├───────────────────────┤
│ ▶ Task Name  0:45  ■  │  ← sticky timer bar (from Session 2)
└───────────────────────┘
```

### Subtask Section

```
Subtasks (3/5 done)
┌─────────────────────────────────────────┐
│ ☑ Design mockups           [↑] [↓]     │
│ ☐ Build frontend pages     [↑] [↓]     │
│ ☑ Write API endpoints      [↑] [↓]     │
│ ☐ Integration testing      [↑] [↓]     │
│ ☑ Code review              [↑] [↓]     │
├─────────────────────────────────────────┤
│ + Add subtask...  [Enter to create]     │
└─────────────────────────────────────────┘
```

### 4.1 New File: `lib/parse-duration.ts`

```ts
/**
 * Parse free-text duration string to minutes.
 * Supports: "1h 30m", "1.5h", "90m", "1:30", "45" (assumed minutes).
 * Returns number of minutes or null if unparsable.
 */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // "1h 30m" or "1h" or "30m"
  const hmMatch = trimmed.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/i);
  if (hmMatch && (hmMatch[1] || hmMatch[2])) {
    const hours = parseInt(hmMatch[1] || "0", 10);
    const minutes = parseInt(hmMatch[2] || "0", 10);
    return hours * 60 + minutes;
  }

  // "1.5h"
  const decimalHMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*h$/i);
  if (decimalHMatch) {
    return Math.round(parseFloat(decimalHMatch[1]) * 60);
  }

  // "1:30" (h:mm)
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    if (minutes < 60) return hours * 60 + minutes;
  }

  // Plain number (assumed minutes)
  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  return null;
}
```

### 4.2 Tests: `lib/parse-duration.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { parseDuration } from "./parse-duration";

describe("parseDuration", () => {
  it("parses '1h 30m' → 90", () => expect(parseDuration("1h 30m")).toBe(90));
  it("parses '1h' → 60", () => expect(parseDuration("1h")).toBe(60));
  it("parses '30m' → 30", () => expect(parseDuration("30m")).toBe(30));
  it("parses '1.5h' → 90", () => expect(parseDuration("1.5h")).toBe(90));
  it("parses '90m' → 90", () => expect(parseDuration("90m")).toBe(90));
  it("parses '1:30' → 90", () => expect(parseDuration("1:30")).toBe(90));
  it("parses '45' → 45", () => expect(parseDuration("45")).toBe(45));
  it("parses '0:45' → 45", () => expect(parseDuration("0:45")).toBe(45));
  it("returns null for empty", () => expect(parseDuration("")).toBeNull());
  it("returns null for garbage", () => expect(parseDuration("abc")).toBeNull());
});
```

### 4.3 Modify: `convex/tasks.ts`

Add `import { internal } from "./_generated/api"` if not already present (from Session 1).

**Add `updateDescription` mutation** (after existing mutations, before bulk actions):

```ts
export const updateDescription = mutation({
  args: {
    id: v.id("tasks"),
    description: v.any(),
  },
  handler: async (ctx, { id, description }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");
    if (!isAdmin(user) && !task.assigneeIds.includes(user._id)) {
      throw new Error("Access denied");
    }
    await ctx.db.patch(id, { description });
    await ctx.runMutation(internal.activityLog.log, {
      taskId: id, userId: user._id, action: "edited description",
    });
  },
});
```

**Add `swapSubtaskOrder` mutation**:

```ts
export const swapSubtaskOrder = mutation({
  args: {
    taskId: v.id("tasks"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, { taskId, direction }) => {
    const user = await requireAuth(ctx);
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!task.parentTaskId) throw new Error("Not a subtask");

    const siblings = await ctx.db.query("tasks")
      .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", task.parentTaskId))
      .collect();

    siblings.sort((a, b) => {
      const aOrder = a.sortOrder ?? a._creationTime;
      const bOrder = b.sortOrder ?? b._creationTime;
      return aOrder - bOrder;
    });

    const idx = siblings.findIndex((s) => s._id === taskId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const current = siblings[idx];
    const swap = siblings[swapIdx];
    const currentOrder = current.sortOrder ?? current._creationTime;
    const swapOrder = swap.sortOrder ?? swap._creationTime;

    await ctx.db.patch(current._id, { sortOrder: swapOrder });
    await ctx.db.patch(swap._id, { sortOrder: currentOrder });
  },
});
```

**Enhance `get` query** — add subtask enrichment. After the existing `totalMinutes` calculation and before the `return`, add:

```ts
// Subtasks
const subtasks = await ctx.db.query("tasks")
  .withIndex("by_parentTaskId", (q) => q.eq("parentTaskId", id))
  .collect();

subtasks.sort((a, b) => {
  const aOrder = a.sortOrder ?? a._creationTime;
  const bOrder = b.sortOrder ?? b._creationTime;
  return aOrder - bOrder;
});

let subtaskTotalMinutes = 0;
for (const st of subtasks) {
  const stEntries = await ctx.db.query("timeEntries")
    .withIndex("by_taskId", (q) => q.eq("taskId", st._id))
    .collect();
  subtaskTotalMinutes += stEntries.reduce((sum: number, e: any) => sum + e.durationMinutes, 0);
}

const enrichedSubtasks = subtasks.map((st) => ({
  _id: st._id,
  title: st.title,
  status: st.status,
  sortOrder: st.sortOrder,
  _creationTime: st._creationTime,
}));
```

Then update the return to include `subtasks: enrichedSubtasks` and `subtaskTotalMinutes`.

### 4.4 New File: `components/task-detail-dialog.tsx`

**Architecture**: This is the shell component. It should:
- Accept props: `taskId: Id<"tasks"> | null`, `open: boolean`, `onOpenChange: (open: boolean) => void`
- Call `useQuery(api.tasks.get, taskId ? { id: taskId } : "skip")`
- On desktop (`!useIsMobile()`): render shadcn `Dialog` with `DialogContent` (max-w-5xl)
- On mobile: render shadcn `Sheet` (side="bottom", full height)
- **Left column** (60% width desktop, full width mobile): editable title input (debounced save), description placeholder div (Tiptap wired in Session 5), `<TaskDetailSubtasks>`, attachments placeholder, add-time placeholder, time entries placeholder
- **Right column** (40% width desktop, stacked on mobile): `<TaskDetailMetadata>`, `<Tabs>` with "Activity" and "Comments" tabs (content wired in Sessions 5-6)
- Title edit: controlled `Input`, auto-save on blur or 1s debounce via `api.tasks.update`
- Both columns wrapped in `ScrollArea`

**Install shadcn components first if missing**:
```bash
npx shadcn@latest add sheet scroll-area tabs progress switch avatar
```

### 4.5 New File: `components/task-detail-subtasks.tsx`

- Props: `taskId: Id<"tasks">`, `subtasks: Array<{_id, title, status, sortOrder, _creationTime}>`, `isAdmin: boolean`
- Each subtask row: `Checkbox` (checked = status === "done"), title text, up/down `Button` icons
- Checkbox toggle: calls `api.tasks.updateStatus` with toggled status (done ↔ inbox). Note: "done" is admin-only, so members checking a subtask as done should be blocked (the mutation handles this).
- Up/down: calls `api.tasks.swapSubtaskOrder` with `{taskId: subtask._id, direction}`
- Inline create at bottom: `Input` with placeholder "Add subtask...", Enter calls `api.tasks.create` with `{ title, parentTaskId: taskId }`
- Header: "Subtasks (X/Y done)" where Y = total, X = count with status "done"

### 4.6 New File: `components/task-detail-metadata.tsx`

- Props: `task` (the enriched task from `api.tasks.get`), `isAdmin: boolean`
- Layout: vertical stack of labeled rows
- Reuses existing inline editors: `TaskStatusSelect`, `TaskProjectSelector`, `TaskAssigneePicker`, `TaskCategorySelect`
- **Billable toggle**: shadcn `Switch`, calls `api.tasks.update` with `{ id: task._id, billable }`
- **Estimate input**: text input, `parseDuration()` on blur/enter, calls `api.tasks.update` with `{ id: task._id, estimate: minutes }`. Display current value using `formatDuration()`.
- **Time summary section**: Shows "Xh Ym / Xh Ym estimated" using `formatDuration`. Progress bar using shadcn `Progress` with `value = Math.min(100, (totalMinutes / estimate) * 100)`. If no estimate, just show logged time.

### 4.7 Modify: `components/task-list-table.tsx`

Add `onOpenTask?: (taskId: string) => void` prop to `TaskListTable`. Pass it down to `TaskRow` and `TaskCard`.

**TaskRow**: Add `onClick` on the `<TableRow>` that calls `onOpenTask?.(task._id)`. Add `cursor-pointer` class. Add `onClick={(e) => e.stopPropagation()}` on all inline editor wrapper cells (project, assignees, status, category, checkbox, actions) to prevent opening the detail when clicking editors.

**TaskCard**: Same approach — the card div gets `onClick={() => onOpenTask?.(task._id)}` with `cursor-pointer`, and interactive elements get `stopPropagation`.

### 4.8 Modify: `app/(dashboard)/tasks/page.tsx`

Add imports: `useSearchParams`, `useRouter`, `TaskDetailDialog`

In `TasksPageInner`:
```tsx
const searchParams = useSearchParams()
const router = useRouter()
const openTaskId = searchParams.get("task") as Id<"tasks"> | null

const handleOpenTask = useCallback((taskId: string) => {
  const params = new URLSearchParams(searchParams.toString())
  params.set("task", taskId)
  router.push(`?${params.toString()}`, { scroll: false })
}, [router, searchParams])

const handleCloseTask = useCallback(() => {
  const params = new URLSearchParams(searchParams.toString())
  params.delete("task")
  const qs = params.toString()
  router.push(qs ? `?${qs}` : "/tasks", { scroll: false })
}, [router, searchParams])
```

Pass `onOpenTask={handleOpenTask}` to `<TaskListTable>`.

After `<TaskListTable>`, render:
```tsx
<TaskDetailDialog
  taskId={openTaskId}
  open={!!openTaskId}
  onOpenChange={(open) => { if (!open) handleCloseTask() }}
/>
```

### 4.9 Additional Tests (append to `convex/tasks.test.ts`)

```ts
// ═══════════════════════════════════════════════════════════════════════
// tasks.updateDescription
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.updateDescription", () => {
  it("saves Tiptap JSON", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });

    const tiptapDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };
    await asAdmin.mutation(api.tasks.updateDescription, { id: taskId, description: tiptapDoc });

    const raw = await t.run(async (ctx) => ctx.db.get(taskId));
    expect(raw!.description).toEqual(tiptapDoc);
  });

  it("member on assigned task", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const memberUser = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "member_1")).unique()
    );
    const taskId = await asAdmin.mutation(api.tasks.create, {
      title: "Task", assigneeIds: [memberUser!._id],
    });

    await asMember.mutation(api.tasks.updateDescription, { id: taskId, description: { text: "ok" } });
    const raw = await t.run(async (ctx) => ctx.db.get(taskId));
    expect(raw!.description).toEqual({ text: "ok" });
  });

  it("member blocked on unassigned", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const asMember = await setupMember(t);
    const taskId = await asAdmin.mutation(api.tasks.create, { title: "Task" });

    await expect(
      asMember.mutation(api.tasks.updateDescription, { id: taskId, description: {} }),
    ).rejects.toThrow("Access denied");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.swapSubtaskOrder
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.swapSubtaskOrder", () => {
  it("swaps correctly", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const parentId = await asAdmin.mutation(api.tasks.create, { title: "Parent" });
    const sub1 = await asAdmin.mutation(api.tasks.create, { title: "Sub 1", parentTaskId: parentId });
    const sub2 = await asAdmin.mutation(api.tasks.create, { title: "Sub 2", parentTaskId: parentId });

    // Move sub2 up
    await asAdmin.mutation(api.tasks.swapSubtaskOrder, { taskId: sub2, direction: "up" });

    const parent = await asAdmin.query(api.tasks.get, { id: parentId });
    expect(parent.subtasks[0]._id).toBe(sub2);
    expect(parent.subtasks[1]._id).toBe(sub1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// tasks.get — subtask enrichment
// ═══════════════════════════════════════════════════════════════════════

describe("tasks.get — subtasks", () => {
  it("returns subtasks with enrichment", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const parentId = await asAdmin.mutation(api.tasks.create, { title: "Parent" });
    await asAdmin.mutation(api.tasks.create, { title: "Sub 1", parentTaskId: parentId });
    await asAdmin.mutation(api.tasks.create, { title: "Sub 2", parentTaskId: parentId });

    const parent = await asAdmin.query(api.tasks.get, { id: parentId });
    expect(parent.subtasks).toHaveLength(2);
    expect(parent.subtasks[0].title).toBe("Sub 1");
  });

  it("parent totalMinutes includes subtask time", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = await setupAdmin(t);
    const { projectId } = await setupClientProject(asAdmin);
    const parentId = await asAdmin.mutation(api.tasks.create, { title: "Parent", projectId });
    const subId = await asAdmin.mutation(api.tasks.create, { title: "Sub", parentTaskId: parentId });

    // Add time to subtask
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "admin_1")).unique();
      await ctx.db.insert("timeEntries", {
        taskId: subId, userId: user!._id, date: "2025-06-15", durationMinutes: 30, method: "manual",
      });
    });

    const parent = await asAdmin.query(api.tasks.get, { id: parentId });
    expect(parent.subtaskTotalMinutes).toBe(30);
  });
});
```

### 4.10 Commit

```bash
git add lib/parse-duration.ts lib/parse-duration.test.ts convex/tasks.ts convex/tasks.test.ts \
  components/task-detail-dialog.tsx components/task-detail-subtasks.tsx components/task-detail-metadata.tsx \
  components/task-list-table.tsx app/\(dashboard\)/tasks/page.tsx components/ui/*.tsx
git commit -m "feat(phase-4): task detail dialog with metadata editors + subtasks (4.1, 4.2)"
```

---

## Session 5: Tiptap + Add Time + Comments UI + Attachments UI

**Dependencies:** Sessions 2–4
**Commit:** `feat(phase-4): tiptap editor, add-time component, comments + attachments UI (4.1, 4.3, 4.5, 4.8)`

### 5.1 NPM Install

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-mention @tiptap/extension-placeholder @tiptap/pm
```

### Tiptap Editor Toolbar Wireframe

```
┌──────────────────────────────────────────────┐
│ B  I  S  │ H₁ H₂ │ • - ☐ │ ❝  <> │ ── │
├──────────────────────────────────────────────┤
│                                              │
│  Rich text content here with **bold**,       │
│  _italic_, ~~strike~~, and:                  │
│                                              │
│  - Bullet lists                              │
│  - [x] Task checklists                       │
│  > Blockquotes                               │
│  `inline code`                               │
│                                              │
└──────────────────────────────────────────────┘
```

### Add Time Component Wireframe

```
┌──────────────────────────────────────────────┐
│  Duration                                     │
│  [15m] [30m] [45m] [1h]    [−1h] [+1h]      │
│  ┌──────────────────────┐                     │
│  │ 1h 30m               │  ← free-text input │
│  └──────────────────────┘                     │
│  Date: Today ▾  (expands to calendar picker)  │
│  Note: ┌──────────────────┐                   │
│        │ Optional note     │                   │
│        └──────────────────┘                   │
│                              [Add Time]       │
└──────────────────────────────────────────────┘
```

### Comment Thread Wireframe

```
┌──────────────────────────────────────────────┐
│  Comments (3)                                 │
│                                               │
│  👤 John Doe · 2h ago                    [✕] │
│  Hey @Jane, can you review the mockups?       │
│                                               │
│  👤 Jane Smith · 1h ago                  [✕] │
│  Looks good! I'll push feedback by EOD.       │
│                                               │
│  👤 John Doe · 30m ago                   [✕] │
│  Thanks @Jane!                                │
│  ────────────────────────────────────────     │
│  [B I S │ • - │ @]                            │
│  ┌──────────────────────────────────────┐     │
│  │ Write a comment... type @ to mention │     │
│  └──────────────────────────────────────┘     │
│                              [Post Comment]   │
└──────────────────────────────────────────────┘
```

### 5.2 New File: `components/tiptap-editor.tsx`

- Props: `content: any`, `onUpdate: (json: any) => void`, `placeholder?: string`, `editable?: boolean`, `toolbar?: boolean`
- Use `useEditor` from `@tiptap/react` with extensions: `StarterKit`, `TaskList`, `TaskItem.configure({ nested: false })`, `Placeholder.configure({ placeholder })`
- Use `EditorContent` component from tiptap
- Toolbar: row of toggle buttons using shadcn `Toggle` or `Button variant="ghost" size="sm"`. Each button checks `editor.isActive(...)` for active state and calls `editor.chain().focus().toggleBold().run()` etc.
- Toolbar buttons: Bold, Italic, Strike | H1, H2 | Bullet List, Ordered List, Task List | Blockquote, Code | Horizontal Rule
- Call `onUpdate(editor.getJSON())` in `onUpdate` callback of useEditor (the parent component handles debouncing)
- When `editable` is false, hide toolbar and make editor read-only (used for rendering comments)
- Style the editor with Tailwind: `prose prose-sm max-w-none` for the content area, min-height ~100px when editable

### 5.3 New File: `components/tiptap-comment-editor.tsx`

- Props: `onSubmit: (content: any, mentionedUserIds: string[]) => void`, `disabled?: boolean`
- Same tiptap setup as tiptap-editor + `Mention` extension from `@tiptap/extension-mention`
- Mention suggestion configuration:
  - Query `api.users.listAll` for the user list
  - `suggestion.items`: filter users by query text
  - `suggestion.render`: render a dropdown of matching users (use a simple floating div with `absolute` positioning, or a shadcn `Popover`)
  - Each mention stores `{ id: userId, label: userName }` in the Tiptap JSON
- Submit handler: extract all mention node IDs from `editor.getJSON()` by walking the doc tree looking for nodes with `type: "mention"` and collecting their `attrs.id` values. Call `onSubmit(content, mentionIds)`. Then call `editor.commands.clearContent()`.
- Submit trigger: "Post Comment" button + `Cmd+Enter` / `Ctrl+Enter` keyboard shortcut
- Compact toolbar: just Bold, Italic, Strike, Bullet List

### 5.4 New File: `hooks/use-debounced-save.ts`

```ts
import { useRef, useCallback, useEffect } from "react";

export function useDebouncedSave<T>(
  saveFn: (value: T) => Promise<void>,
  delay = 1000,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const trigger = useCallback(
    (value: T) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        await saveFnRef.current(value);
      }, delay);
    },
    [delay],
  );

  return trigger;
}
```

### 5.5 New File: `components/add-time-form.tsx`

- Props: `taskId: Id<"tasks">`, `hasProject: boolean`, `onSuccess?: () => void`, `compact?: boolean`
- State: `durationText` (string), `date` (string, default today YYYY-MM-DD), `note` (string)
- If `!hasProject`: show disabled state with message "Assign a project first"
- Preset chips row: `[15m] [30m] [45m] [1h]` — clicking one **replaces** the current duration text (not adds). Use `formatDuration(minutes)` to set the text.
- Stepper buttons: `[−1h] [+1h]` — parse current text with `parseDuration`, subtract/add 60, format back. Floor at 0.
- Duration input: text input, value = `durationText`, parsed with `parseDuration()` on submit
- Date: shadcn `Popover` + `Calendar` for date picker. Display as formatted date, default "Today".
- Note: optional text `Input`
- Submit button: "Add Time" — calls `api.timeEntries.create({ taskId, durationMinutes, date, note })`. Toast on error. Call `onSuccess?.()` and reset form on success.
- In `compact` mode: hide note field, smaller layout (for popover in task list)

### 5.6 New File: `components/timer-button.tsx`

- Props: `taskId: Id<"tasks">`, `taskTitle: string`, `hasProject: boolean`
- Uses `useQuery(api.timer.getStatus)` to check if timer is running on this task
- Uses `useMutation(api.timer.start)` and `useMutation(api.timer.stop)`
- If timer is running on THIS task: show stop button (Square icon). Click stops timer.
- If timer is not running or running on a different task: show play button (Play icon). Click starts timer. If auto-stopping a different task, the mutation returns `previousTaskTitle` — show an info toast like "Stopped timer on {previousTaskTitle} ({Xm})".
- If `!hasProject`: disable button with `Tooltip` saying "Assign a project to start timer"
- Button style: `variant="ghost" size="icon"`, small (size-7)

### 5.7 New File: `components/task-detail-attachments.tsx`

- Props: `taskId: Id<"tasks">`, `isAdmin: boolean`, `currentUserId: Id<"users">`
- Uses `useQuery(api.attachments.list, { taskId })`
- Upload zone: a dashed-border div that accepts drag-and-drop + a "Upload files" `Button`
  - Client-side validation before uploading: check size (10MB), MIME type, current count < 20
  - Upload flow: `const url = await generateUploadUrl({})` → `const result = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file })` → `const { storageId } = await result.json()` → `await attachments.create({ taskId, storageId, fileName, mimeType, size })`
  - Show upload progress with a loading indicator per file
- List: each attachment shows file icon (based on MIME), filename, size (formatted e.g. "1.2 MB"), uploader name, relative time
- Images (MIME starts with `image/`): show inline thumbnail using the storage URL
- Non-images: show as download link (`<a href={url} target="_blank" download>`)
- Delete button: show for uploader or admin. Uses `useUndoAction` hook for undo toast.
- Header: "Files (X/20)"

### 5.8 New File: `components/task-detail-comments.tsx`

- Props: `taskId: Id<"tasks">`, `isAdmin: boolean`, `currentUserId: Id<"users">`
- Uses `useQuery(api.comments.list, { taskId })` with pagination
- Comment list (newest first): each comment shows avatar (`Avatar` with user initials fallback), user name, relative timestamp (`formatDistanceToNow`), and rendered Tiptap content (use `TiptapEditor` with `editable={false}` and `toolbar={false}`)
- Delete button (X icon): visible for author or admin. Uses `useUndoAction`.
- At bottom: `TiptapCommentEditor` with `onSubmit` that calls `api.comments.create({ taskId, content, mentionedUserIds })`
- Load more button if `!isDone`

### 5.9 Wire Everything into `components/task-detail-dialog.tsx`

Update the dialog shell from Session 4:

**Left column** (in order):
1. Timer button (from `timer-button.tsx`) next to editable title
2. `TiptapEditor` for description, with `useDebouncedSave` calling `api.tasks.updateDescription`
3. `TaskDetailSubtasks` (from Session 4)
4. `TaskDetailAttachments`
5. `AddTimeForm`
6. Time entries placeholder (wired in Session 6)

**Right column tabs**:
- Activity tab: placeholder div (wired in Session 6)
- Comments tab: `TaskDetailComments`

### 5.10 Install shadcn components if missing

```bash
npx shadcn@latest add calendar popover progress switch sheet scroll-area tabs avatar toggle
```

### 5.11 Commit

```bash
git add components/tiptap-editor.tsx components/tiptap-comment-editor.tsx hooks/use-debounced-save.ts \
  components/add-time-form.tsx components/timer-button.tsx \
  components/task-detail-attachments.tsx components/task-detail-comments.tsx \
  components/task-detail-dialog.tsx package.json package-lock.json components/ui/*.tsx
git commit -m "feat(phase-4): tiptap editor, add-time component, comments + attachments UI (4.1, 4.3, 4.5, 4.8)"
```

---

## Session 6: Time Entry List + Activity Tab + Polish

**Dependencies:** Session 5
**Commit:** `feat(phase-4): time entry list, activity log tab, responsive polish (4.6, 4.7)`

### Time Entries List Wireframe

```
Time Entries
┌──────────────────────────────────────────────┐
│  2h 00m  · Today     · 👤 John  · "API work" │  [✏] [✕]
│  1h 30m  · Yesterday · 👤 Jane               │  [✏] [✕]
│  45m     · Feb 12    · 👤 John  · "Frontend" │  [✏] [✕]
│                                               │
│  [Load more...]                               │
└──────────────────────────────────────────────┘

Edit mode (inline):
┌──────────────────────────────────────────────┐
│  Duration: [2h 30m    ]  Date: [2025-02-15]  │
│  Note: [Updated API work  ]    [Save] [✕]    │
└──────────────────────────────────────────────┘
```

### Activity Log Wireframe

```
Activity
┌──────────────────────────────────────────────┐
│  👤 John changed status inbox → today · 2h   │
│  👤 Jane added a comment · 3h                │
│  👤 John started timer · 5h                  │
│  👤 John stopped timer (1h 30m) · 4h         │
│  👤 Jane uploaded mockup.png · 6h            │
│  👤 John edited description · 1d             │
│  👤 Admin created task · 2d                  │
│  [Load more...]                               │
└──────────────────────────────────────────────┘
```

### 6.1 New File: `components/task-detail-time-entries.tsx`

- Props: `taskId: Id<"tasks">`, `isAdmin: boolean`, `currentUserId: Id<"users">`
- Uses `useQuery(api.timeEntries.list, { taskId })` with cursor-based pagination
- State: `editingId` (string | null) for inline edit mode
- **List view**: each entry shows:
  - Duration: `formatDuration(entry.durationMinutes)`
  - Date: `formatDate(entry.date)` or "Today" / "Yesterday" for recent dates
  - User: avatar + name
  - Note: truncated with ellipsis
  - Edit button (pencil icon): only on own entries or if admin. Sets `editingId`.
  - Delete button (X icon): only on own entries or if admin. Uses `useUndoAction`.
- **Edit mode** (when `editingId === entry._id`): inline form replaces the entry row
  - Duration: text input pre-filled with `formatDuration()`, parsed with `parseDuration()` on save
  - Date: shadcn `Popover` + `Calendar`
  - Note: text input
  - Save button: calls `api.timeEntries.update({ id, durationMinutes, date, note })`, then sets `editingId = null`
  - Cancel button: sets `editingId = null`
- Load more button if `!isDone`

### 6.2 New File: `components/task-detail-activity.tsx`

- Props: `taskId: Id<"tasks">`
- Uses `useQuery(api.activityLog.list, { taskId })` with cursor-based pagination
- Each entry: avatar (user), user name, action text (already human-readable from the log calls), relative timestamp via `formatDistanceToNow(entry._creationTime)`
- Very simple component — just a list of events, no edit/delete
- Load more button if `!isDone`
- Empty state: "No activity yet"

### 6.3 Wire into `components/task-detail-dialog.tsx`

- Import and render `TaskDetailTimeEntries` in left column (after `AddTimeForm`)
- Import and render `TaskDetailActivity` in the Activity tab (right column)
- Both components now replace the placeholder divs from Session 4

### 6.4 Polish Checklist

**Mobile dialog**: Verify the `Sheet` renders full-screen on mobile. Content should be a single scrollable column with metadata first, then all left-column sections, then tabs.

**Timer indicator mobile z-index**: The timer bar is `z-50`. The bulk action bar should be `z-40`. If both are visible, timer should be on top. Add `pb-14` (56px padding) to main content area when timer is running on mobile so content isn't hidden behind the bar. You can check timer status in the layout: `const timerStatus = useQuery(api.timer.getStatus)` and conditionally add padding.

**Keyboard**:
- Escape closes dialog/sheet (shadcn handles this automatically)
- Tab navigation through interactive elements (shadcn Dialog/Sheet have focus trapping built in)

**Timer indicator task navigation**: Already implemented in Session 2 — clicking task name in the timer indicator sets `?task=<id>` which opens the detail dialog.

### 6.5 Optional: Task List Timer Button + Quick Add Time Popover

If not already done in Session 4, enhance `components/task-list-table.tsx`:

- In `TaskRow`, add a small `TimerButton` in the Time column area (visible on hover via `opacity-0 group-hover:opacity-100`)
- Optionally: clicking the time value opens a `Popover` containing `<AddTimeForm taskId={...} hasProject={!!task.projectId} compact />`

### 6.6 Commit

```bash
git add components/task-detail-time-entries.tsx components/task-detail-activity.tsx \
  components/task-detail-dialog.tsx components/task-list-table.tsx app/\(dashboard\)/layout.tsx
git commit -m "feat(phase-4): time entry list, activity log tab, responsive polish (4.6, 4.7)"
```

---

## Complete File Registry

### New Files (19)
| File | Session |
|------|---------|
| `convex/timeEntries.ts` | 1 ✅ |
| `convex/activityLog.ts` | 1 ✅ |
| `convex/timer.ts` | 2 |
| `convex/attachments.ts` | 3 |
| `convex/comments.ts` | 3 |
| `lib/parse-duration.ts` | 4 |
| `hooks/use-debounced-save.ts` | 5 |
| `components/timer-indicator.tsx` | 2 |
| `components/timer-button.tsx` | 5 |
| `components/task-detail-dialog.tsx` | 4 |
| `components/task-detail-metadata.tsx` | 4 |
| `components/task-detail-subtasks.tsx` | 4 |
| `components/task-detail-attachments.tsx` | 5 |
| `components/task-detail-comments.tsx` | 5 |
| `components/task-detail-time-entries.tsx` | 6 |
| `components/task-detail-activity.tsx` | 6 |
| `components/tiptap-editor.tsx` | 5 |
| `components/tiptap-comment-editor.tsx` | 5 |
| `components/add-time-form.tsx` | 5 |

### Modified Files
| File | Session |
|------|---------|
| `convex/schema.ts` | 1 ✅ |
| `convex/tasks.ts` | 1, 4 |
| `app/(dashboard)/layout.tsx` | 2 |
| `app/(dashboard)/tasks/page.tsx` | 4 |
| `components/task-list-table.tsx` | 4, 6 |

### Test Files (7)
| File | Tests | Session |
|------|-------|---------|
| `convex/timeEntries.test.ts` | 11 | 1 |
| `convex/activityLog.test.ts` | 3 | 1 |
| `convex/timer.test.ts` | 9 | 2 |
| `convex/attachments.test.ts` | 7 | 3 |
| `convex/comments.test.ts` | 7 | 3 |
| `lib/parse-duration.test.ts` | 10 | 4 |
| `convex/tasks.test.ts` (additions) | 6 | 4 |
| **Total** | **53** | |

### Reused Existing Code
| Module | Used For |
|--------|----------|
| `hooks/use-undo-action.ts` | Timer auto-stop, attachment delete, time entry delete, comment delete |
| `hooks/use-mobile.ts` | Dialog vs Sheet switch, timer mobile bar |
| `lib/format.ts` | `formatDuration`, `formatDate`, `formatDistanceToNow` |
| `convex/lib/permissions.ts` | `requireAuth`, `requireAdmin`, `isAdmin` in all new Convex functions |
| `TaskStatusSelect` | In task-detail-metadata |
| `TaskProjectSelector` | In task-detail-metadata |
| `TaskAssigneePicker` | In task-detail-metadata |
| `TaskCategorySelect` | In task-detail-metadata |

---

## Post-Implementation Checklist

After all 6 sessions:

1. **Run all tests**: `npx vitest` — should pass ~138 tests (85 existing + 53 new)
2. **Type check**: `npx tsc --noEmit`
3. **Manual smoke test** (requires `npx convex dev`):
   - Click task row → dialog opens, URL has `?task=<id>`
   - Edit title → auto-saves after 1s debounce
   - Change status/assignees/project/category → saved immediately
   - Type in description → rich text formatting, auto-saves after 1s
   - Create subtask inline → appears in list
   - Up/down arrows reorder subtasks
   - Upload file → inline preview for images, download link for PDFs
   - 11MB file → client-side error; .exe → rejected
   - Start timer on task → indicator appears in header (desktop) / bottom bar (mobile)
   - Stop timer → time entry created; sub-minute → save/discard prompt
   - Navigate to different page → timer indicator persists
   - Add manual time: click 30m chip → shows "30m", click 1h → shows "1h" (replaces)
   - Type "1h 30m" → parses to 90m on submit
   - Post comment with @mention → notification created
   - Activity tab shows all events chronologically
   - Close dialog → URL param removed
   - Mobile: full-screen sheet, metadata on top, content below, timer bottom bar
   - Full keyboard navigation (Tab, Escape)
4. Create PR from `phase-3` (or a new `phase-4` branch) into `main`
