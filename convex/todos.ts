import { type ObjectType, v } from "convex/values";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { type AppUser, requireUnlockedProject, requireUser } from "./helpers";

const statusValidator = v.union(
	v.literal("todo"),
	v.literal("in_progress"),
	v.literal("done"),
	v.literal("cancelled"),
);
const priorityValidator = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
);

function normalizeTodoLink(raw?: string) {
	const trimmed = raw?.trim();
	if (!trimmed) return undefined;

	const candidate =
		trimmed.startsWith("http://") || trimmed.startsWith("https://")
			? trimmed
			: `https://${trimmed}`;

	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		throw new Error("Todo link must be a valid URL");
	}

	if (!["http:", "https:"].includes(url.protocol)) {
		throw new Error("Todo link must start with http:// or https://");
	}

	return url.toString();
}

export const listByProject = query({
	args: {
		projectId: v.id("projects"),
		includeArchived: v.optional(v.boolean()),
	},
	handler: async (ctx, { projectId, includeArchived }) => {
		await requireUser(ctx);
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
	args: {},
	handler: async (ctx, {}) => {
		await requireUser(ctx);
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
	args: { todoId: v.id("todos") },
	handler: async (ctx, { todoId }) => {
		await requireUser(ctx);
		return await ctx.db.get(todoId);
	},
});

const createArgs = {
	projectId: v.id("projects"),
	title: v.string(),
	description: v.optional(v.string()),
	link: v.optional(v.string()),
	status: v.optional(statusValidator),
	cancelReason: v.optional(v.string()),
	priority: v.optional(priorityValidator),
};

export async function createTodoAs(
	ctx: MutationCtx,
	user: AppUser,
	{
			projectId,
			title,
			description,
			link,
			status,
			cancelReason,
			priority,
		}: ObjectType<typeof createArgs>,
) {
	await requireUnlockedProject(ctx, projectId);
	const trimmed = title.trim();
	const normalizedLink = normalizeTodoLink(link);
	const normalizedCancelReason = cancelReason?.trim() || undefined;
	if (!trimmed) throw new Error("Title is required");

	const todoId = await ctx.db.insert("todos", {
		projectId,
		title: trimmed,
		description: description ?? "",
		link: normalizedLink,
		status: status ?? "todo",
		cancelReason: status === "cancelled" ? normalizedCancelReason : undefined,
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
}

export const create = mutation({
	args: createArgs,
	handler: async (ctx, args) =>
		await createTodoAs(ctx, await requireUser(ctx), args),
});

const updateArgs = {
	todoId: v.id("todos"),
	title: v.optional(v.string()),
	description: v.optional(v.string()),
	link: v.optional(v.string()),
	status: v.optional(statusValidator),
	cancelReason: v.optional(v.string()),
	priority: v.optional(priorityValidator),
};

export async function updateTodoAs(
	ctx: MutationCtx,
	user: AppUser,
	{ todoId, title, description, link, status, cancelReason, priority }: ObjectType<typeof updateArgs>,
) {
	const todo = await ctx.db.get(todoId);
	if (!todo) throw new Error("Todo not found");
	await requireUnlockedProject(ctx, todo.projectId);

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
	if (link !== undefined) {
		const normalizedLink = normalizeTodoLink(link);
		const previousLink = (todo as { link?: string }).link;
		if (normalizedLink !== previousLink) {
			patch.link = normalizedLink;
			changes.push(
				`link: ${previousLink ?? "(empty)"} → ${normalizedLink ?? "(empty)"}`,
			);
		}
	}
	if (status !== undefined && status !== todo.status) {
		patch.status = status;
		changes.push(`status: ${todo.status} → ${status}`);
	}
	const nextStatus = status ?? todo.status;
	const previousCancelReason = todo.cancelReason;
	if (nextStatus === "cancelled" && cancelReason !== undefined) {
		const normalizedCancelReason = cancelReason.trim() || undefined;
		if (normalizedCancelReason !== previousCancelReason) {
			patch.cancelReason = normalizedCancelReason;
			changes.push(
				normalizedCancelReason
					? `cancellation reason: ${normalizedCancelReason}`
					: "cancellation reason removed",
			);
		}
	} else if (
		nextStatus !== "cancelled" &&
		previousCancelReason !== undefined
	) {
		patch.cancelReason = undefined;
		changes.push("cancellation reason cleared");
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
}

export const update = mutation({
	args: updateArgs,
	handler: async (ctx, args) =>
		await updateTodoAs(ctx, await requireUser(ctx), args),
});

export const archive = mutation({
	args: { todoId: v.id("todos") },
	handler: async (ctx, { todoId }) => {
		const user = await requireUser(ctx);
		const todo = await ctx.db.get(todoId);
		if (!todo) throw new Error("Todo not found");
		await requireUnlockedProject(ctx, todo.projectId);

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
	args: { todoId: v.id("todos") },
	handler: async (ctx, { todoId }) => {
		const user = await requireUser(ctx);
		const todo = await ctx.db.get(todoId);
		if (!todo) throw new Error("Todo not found");
		await requireUnlockedProject(ctx, todo.projectId);

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
