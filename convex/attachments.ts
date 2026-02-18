import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, isAdmin } from "./lib/permissions";
import { logActivity } from "./lib/activityLogger";

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

    await logActivity(ctx, {
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

    await logActivity(ctx, {
      taskId: attachment.taskId, userId: user._id, action: `deleted ${attachment.fileName}`,
    });

    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(id);
  },
});
