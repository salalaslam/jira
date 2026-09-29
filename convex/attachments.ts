import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireUnlockedProject, requireUser } from "./helpers";
import {
	assertFileSize,
	assertObjectKeyForTodo,
	sanitizeFileName,
} from "./storageHelpers";

const attachmentValidator = v.object({
	_id: v.id("todoAttachments"),
	_creationTime: v.number(),
	todoId: v.id("todos"),
	fileName: v.string(),
	contentType: v.string(),
	size: v.number(),
	objectKey: v.string(),
	uploadedBy: v.id("users"),
});

export const listForTodo = query({
	args: {
		todoId: v.id("todos"),
	},
	returns: v.array(attachmentValidator),
	handler: async (ctx, { todoId }) => {
		await requireUser(ctx);
		return await ctx.db
			.query("todoAttachments")
			.withIndex("by_todo", (q) => q.eq("todoId", todoId))
			.collect();
	},
});

export const get = query({
	args: {
		attachmentId: v.id("todoAttachments"),
	},
	handler: async (ctx, { attachmentId }) => {
		await requireUser(ctx);
		return await ctx.db.get(attachmentId);
	},
});

export const listByProject = query({
	args: {
		projectId: v.id("projects"),
	},
	handler: async (ctx, { projectId }) => {
		await requireUser(ctx);
		const todos = await ctx.db
			.query("todos")
			.withIndex("by_project", (q) => q.eq("projectId", projectId))
			.collect();
		const todoIds = new Set(todos.map((t) => t._id));
		const attachments = await ctx.db.query("todoAttachments").collect();
		return attachments.filter((a) => todoIds.has(a.todoId));
	},
});

export const add = mutation({
	args: {
		todoId: v.id("todos"),
		fileName: v.string(),
		contentType: v.string(),
		size: v.number(),
		objectKey: v.string(),
	},
	handler: async (
		ctx,
		{ todoId, fileName, contentType, size, objectKey },
	) => {
		const user = await requireUser(ctx);
		const todo = await ctx.db.get(todoId);
		if (!todo) throw new Error("Todo not found");
		await requireUnlockedProject(ctx, todo.projectId);

		assertFileSize(size);
		assertObjectKeyForTodo(objectKey, todoId);

		const trimmedName = sanitizeFileName(fileName);
		if (!trimmedName) throw new Error("File name is required");

		const attachmentId = await ctx.db.insert("todoAttachments", {
			todoId,
			fileName: trimmedName,
			contentType: contentType || "application/octet-stream",
			size,
			objectKey,
			uploadedBy: user._id,
		});

		await ctx.db.insert("activities", {
			userId: user._id,
			entityType: "todo",
			entityId: todoId,
			projectId: todo.projectId,
			action: "updated",
			details: `attachment added: ${trimmedName}`,
		});

		return attachmentId;
	},
});

export const remove = mutation({
	args: {
		attachmentId: v.id("todoAttachments"),
	},
	handler: async (ctx, { attachmentId }) => {
		const user = await requireUser(ctx);
		const attachment = await ctx.db.get(attachmentId);
		if (!attachment) throw new Error("Attachment not found");

		const todo = await ctx.db.get(attachment.todoId);
		if (!todo) throw new Error("Todo not found");
		await requireUnlockedProject(ctx, todo.projectId);

		await ctx.db.delete(attachmentId);
		await ctx.scheduler.runAfter(
			0,
			internal.attachmentStorage.deleteFromStorage,
			{
				objectKey: attachment.objectKey,
			},
		);

		await ctx.db.insert("activities", {
			userId: user._id,
			entityType: "todo",
			entityId: attachment.todoId,
			projectId: todo.projectId,
			action: "updated",
			details: `attachment removed: ${attachment.fileName}`,
		});
	},
});
