import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type QueryCtx,
} from "./_generated/server";
import { type AppUser, getUserByAuthId } from "./helpers";
import { createTodoAs, updateTodoAs } from "./todos";

// Data layer for the MCP server in http.ts. The caller has already verified
// the OAuth access token; every function acts as that token's user.

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

const siteUrl = () => process.env.SITE_URL ?? "http://localhost:3000";
const ticketUrl = (todo: Doc<"todos">) =>
	`${siteUrl()}/projects/${todo.projectId}/${todo._id}`;

async function requireMcpUser(ctx: QueryCtx, authUserId: string): Promise<AppUser> {
	const user = await getUserByAuthId(ctx, authUserId);
	if (!user) throw new Error("No app account is linked to this sign-in");
	return user;
}

async function resolveProject(ctx: QueryCtx, ref: string) {
	const trimmed = ref.trim();
	const id = ctx.db.normalizeId("projects", trimmed);
	if (id) {
		const project = await ctx.db.get(id);
		if (project && !project.archivedAt) return project;
	}
	const projects = (await ctx.db.query("projects").collect()).filter(
		(p) => !p.archivedAt,
	);
	const needle = trimmed.toLowerCase();
	const exact = projects.filter((p) => p.name.toLowerCase() === needle);
	if (exact.length === 1) return exact[0];
	const partial = projects.filter((p) => p.name.toLowerCase().includes(needle));
	if (partial.length === 1) return partial[0];
	if (partial.length > 1) {
		throw new Error(
			`"${ref}" matches several projects: ${partial.map((p) => p.name).join(", ")}. Use the exact name.`,
		);
	}
	throw new Error(`No active project named "${ref}". Call list_projects to see them.`);
}

async function resolveTicket(ctx: QueryCtx, ref: string) {
	const trimmed = ref.trim();
	let candidate = trimmed;
	if (trimmed.includes("://")) {
		try {
			candidate = new URL(trimmed).pathname.split("/").filter(Boolean).pop() ?? "";
		} catch {
			// Fall through to the not-found error.
		}
	}
	const id = ctx.db.normalizeId("todos", candidate);
	const todo = id ? await ctx.db.get(id) : null;
	if (!todo) throw new Error(`Ticket "${ref}" not found.`);
	return todo;
}

function summarize(todo: Doc<"todos">, projectName: string) {
	return {
		id: todo._id,
		title: todo.title,
		status: todo.status,
		priority: todo.priority,
		project: projectName,
		archived: !!todo.archivedAt,
		createdAt: new Date(todo._creationTime).toISOString(),
		url: ticketUrl(todo),
	};
}

export const listProjects = internalQuery({
	args: { authUserId: v.string() },
	handler: async (ctx, { authUserId }) => {
		await requireMcpUser(ctx, authUserId);
		const projects = (await ctx.db.query("projects").collect()).filter(
			(p) => !p.archivedAt,
		);
		return await Promise.all(
			projects.map(async (project) => {
				const todos = (
					await ctx.db
						.query("todos")
						.withIndex("by_project", (q) => q.eq("projectId", project._id))
						.collect()
				).filter((t) => !t.archivedAt);
				const count = (status: Doc<"todos">["status"]) =>
					todos.filter((t) => t.status === status).length;
				return {
					id: project._id,
					name: project.name,
					locked: project.lockedAt !== undefined,
					lockMessage: project.lockMessage,
					link: project.link,
					counts: {
						todo: count("todo"),
						in_progress: count("in_progress"),
						done: count("done"),
						cancelled: count("cancelled"),
					},
					url: `${siteUrl()}/projects/${project._id}`,
				};
			}),
		);
	},
});

export const listTickets = internalQuery({
	args: {
		authUserId: v.string(),
		project: v.optional(v.string()),
		statuses: v.optional(v.array(statusValidator)),
		priority: v.optional(priorityValidator),
		search: v.optional(v.string()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireMcpUser(ctx, args.authUserId);
		const projects = args.project
			? [await resolveProject(ctx, args.project)]
			: (await ctx.db.query("projects").collect()).filter((p) => !p.archivedAt);
		const search = args.search?.trim().toLowerCase();
		const priorityRank = { high: 0, medium: 1, low: 2 } as const;
		const results: ReturnType<typeof summarize>[] = [];
		for (const project of projects) {
			const todos = await ctx.db
				.query("todos")
				.withIndex("by_project", (q) => q.eq("projectId", project._id))
				.collect();
			for (const todo of todos) {
				if (todo.archivedAt) continue;
				if (args.statuses && !args.statuses.includes(todo.status)) continue;
				if (args.priority && todo.priority !== args.priority) continue;
				if (
					search &&
					!todo.title.toLowerCase().includes(search) &&
					!todo.description.toLowerCase().includes(search)
				) {
					continue;
				}
				results.push({ ...summarize(todo, project.name) });
			}
		}
		results.sort(
			(a, b) =>
				priorityRank[a.priority] - priorityRank[b.priority] ||
				b.createdAt.localeCompare(a.createdAt),
		);
		const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
		return { total: results.length, tickets: results.slice(0, limit) };
	},
});

export const getTicket = internalQuery({
	args: { authUserId: v.string(), ticket: v.string() },
	handler: async (ctx, { authUserId, ticket }) => {
		await requireMcpUser(ctx, authUserId);
		const todo = await resolveTicket(ctx, ticket);
		const project = await ctx.db.get(todo.projectId);
		const creator = await ctx.db.get(todo.createdBy);
		const activities = await ctx.db
			.query("activities")
			.withIndex("by_entity", (q) =>
				q.eq("entityType", "todo").eq("entityId", todo._id),
			)
			.collect();
		const attachments = await ctx.db
			.query("todoAttachments")
			.withIndex("by_todo", (q) => q.eq("todoId", todo._id))
			.collect();
		const names = new Map<Id<"users">, string>();
		const nameOf = async (userId: Id<"users">) => {
			if (!names.has(userId)) {
				names.set(userId, (await ctx.db.get(userId))?.displayName ?? "Unknown");
			}
			return names.get(userId);
		};
		return {
			...summarize(todo, project?.name ?? "Unknown"),
			description: todo.description,
			link: todo.link,
			cancelReason: todo.cancelReason,
			createdBy: creator?.displayName,
			projectLocked: project?.lockedAt !== undefined,
			attachments: attachments.map((a) => a.fileName),
			activity: await Promise.all(
				activities
					.sort((a, b) => b._creationTime - a._creationTime)
					.slice(0, 20)
					.map(async (a) => ({
						at: new Date(a._creationTime).toISOString(),
						by: await nameOf(a.userId),
						action: a.action,
						details: a.details,
					})),
			),
		};
	},
});

export const createTicket = internalMutation({
	args: {
		authUserId: v.string(),
		project: v.string(),
		title: v.string(),
		description: v.optional(v.string()),
		priority: v.optional(priorityValidator),
		status: v.optional(statusValidator),
		link: v.optional(v.string()),
	},
	handler: async (ctx, { authUserId, project: projectRef, ...fields }) => {
		const user = await requireMcpUser(ctx, authUserId);
		const project = await resolveProject(ctx, projectRef);
		const todoId = await createTodoAs(ctx, user, {
			projectId: project._id,
			...fields,
		});
		const todo = await ctx.db.get(todoId);
		if (!todo) throw new Error("Ticket was not created");
		return summarize(todo, project.name);
	},
});

export const updateTicket = internalMutation({
	args: {
		authUserId: v.string(),
		ticket: v.string(),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		status: v.optional(statusValidator),
		priority: v.optional(priorityValidator),
		link: v.optional(v.string()),
		cancelReason: v.optional(v.string()),
	},
	handler: async (ctx, { authUserId, ticket, ...fields }) => {
		const user = await requireMcpUser(ctx, authUserId);
		const todo = await resolveTicket(ctx, ticket);
		await updateTodoAs(ctx, user, { todoId: todo._id, ...fields });
		const updated = await ctx.db.get(todo._id);
		const project = await ctx.db.get(todo.projectId);
		if (!updated) throw new Error("Ticket not found");
		return summarize(updated, project?.name ?? "Unknown");
	},
});
