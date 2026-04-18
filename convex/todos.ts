import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./helpers";

const statusValidator = v.union(
	v.literal("todo"),
	v.literal("in_progress"),
	v.literal("done"),
);
const priorityValidator = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
);

export const listByProject = query({
	args: {
		token: v.string(),
		projectId: v.id("projects"),
		includeArchived: v.optional(v.boolean()),
	},
	handler: async (ctx, { token, projectId, includeArchived }) => {
		await requireUser(ctx, token);
		const todos = await ctx.db
			.query("todos")
			.withIndex("by_project", (q) => q.eq("projectId", projectId))
			.collect();
		const filtered = includeArchived
			? todos
			: todos.filter((t) => !t.archivedAt);
		return filtered.sort((a, b) => b._creationTime - a._creationTime);
	},
});

export const listArchived = query({
	args: { token: v.string() },
	handler: async (ctx, { token }) => {
		await requireUser(ctx, token);
		const todos = await ctx.db.query("todos").collect();
		const archived = todos.filter((t) => !!t.archivedAt);
		const withProject = await Promise.all(
			archived.map(async (t) => ({
				...t,
				project: await ctx.db.get(t.projectId),
			})),
		);
		return withProject.sort(
			(a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0),
		);
	},
});

export const get = query({
	args: { token: v.string(), todoId: v.id("todos") },
	handler: async (ctx, { token, todoId }) => {
		await requireUser(ctx, token);
		return await ctx.db.get(todoId);
	},
});

export const create = mutation({
	args: {
		token: v.string(),
		projectId: v.id("projects"),
		title: v.string(),
		description: v.optional(v.string()),
		status: v.optional(statusValidator),
		priority: v.optional(priorityValidator),
	},
	handler: async (
		ctx,
		{ token, projectId, title, description, status, priority },
	) => {
		const user = await requireUser(ctx, token);
		const trimmed = title.trim();
		if (!trimmed) throw new Error("Title is required");

		const todoId = await ctx.db.insert("todos", {
			projectId,
			title: trimmed,
			description: description ?? "",
			status: status ?? "todo",
			priority: priority ?? "medium",
			createdBy: user._id,
		});

		await ctx.db.insert("activities", {
			userId: user._id,
			entityType: "todo",
			entityId: todoId,
			projectId,
			action: "created",
			details: trimmed,
		});

		return todoId;
	},
});

export const update = mutation({
	args: {
		token: v.string(),
		todoId: v.id("todos"),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		status: v.optional(statusValidator),
		priority: v.optional(priorityValidator),
	},
	handler: async (
		ctx,
		{ token, todoId, title, description, status, priority },
	) => {
		const user = await requireUser(ctx, token);
		const todo = await ctx.db.get(todoId);
		if (!todo) throw new Error("Todo not found");

		const patch: Record<string, unknown> = {};
		const changes: string[] = [];

		if (title !== undefined && title.trim() && title.trim() !== todo.title) {
			patch.title = title.trim();
			changes.push(`title changed`);
		}
		if (description !== undefined && description !== todo.description) {
			patch.description = description;
			changes.push(`description updated`);
		}
		if (status !== undefined && status !== todo.status) {
			patch.status = status;
			changes.push(`status: ${todo.status} → ${status}`);
		}
		if (priority !== undefined && priority !== todo.priority) {
			patch.priority = priority;
			changes.push(`priority: ${todo.priority} → ${priority}`);
		}

		if (Object.keys(patch).length === 0) return;

		await ctx.db.patch(todoId, patch);
		await ctx.db.insert("activities", {
			userId: user._id,
			entityType: "todo",
			entityId: todoId,
			projectId: todo.projectId,
			action: "updated",
			details: changes.join(", "),
		});
	},
});

export const archive = mutation({
	args: { token: v.string(), todoId: v.id("todos") },
	handler: async (ctx, { token, todoId }) => {
		const user = await requireUser(ctx, token);
		const todo = await ctx.db.get(todoId);
		if (!todo) throw new Error("Todo not found");

		await ctx.db.patch(todoId, { archivedAt: Date.now() });
		await ctx.db.insert("activities", {
			userId: user._id,
			entityType: "todo",
			entityId: todoId,
			projectId: todo.projectId,
			action: "archived",
		});
	},
});

export const unarchive = mutation({
	args: { token: v.string(), todoId: v.id("todos") },
	handler: async (ctx, { token, todoId }) => {
		const user = await requireUser(ctx, token);
		const todo = await ctx.db.get(todoId);
		if (!todo) throw new Error("Todo not found");

		await ctx.db.patch(todoId, { archivedAt: undefined });
		await ctx.db.insert("activities", {
			userId: user._id,
			entityType: "todo",
			entityId: todoId,
			projectId: todo.projectId,
			action: "unarchived",
		});
	},
});
