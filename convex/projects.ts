import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./helpers";

export const list = query({
	args: {
		token: v.string(),
		includeArchived: v.optional(v.boolean()),
	},
	handler: async (ctx, { token, includeArchived }) => {
		await requireUser(ctx, token);
		const projects = await ctx.db.query("projects").collect();
		const filtered = includeArchived
			? projects
			: projects.filter((p) => !p.archivedAt);

		const withCounts = await Promise.all(
			filtered.map(async (project) => {
				const todos = await ctx.db
					.query("todos")
					.withIndex("by_project", (q) => q.eq("projectId", project._id))
					.collect();
				const active = todos.filter((t) => !t.archivedAt);
				return {
					...project,
					counts: {
						total: active.length,
						todo: active.filter((t) => t.status === "todo").length,
						inProgress: active.filter((t) => t.status === "in_progress").length,
						done: active.filter((t) => t.status === "done").length,
					},
				};
			}),
		);

		return withCounts.sort((a, b) => {
			if (!!a.archivedAt !== !!b.archivedAt) {
				return a.archivedAt ? 1 : -1;
			}
			return b._creationTime - a._creationTime;
		});
	},
});

export const get = query({
	args: { token: v.string(), projectId: v.id("projects") },
	handler: async (ctx, { token, projectId }) => {
		await requireUser(ctx, token);
		const project = await ctx.db.get(projectId);
		return project;
	},
});

export const create = mutation({
	args: {
		token: v.string(),
		name: v.string(),
		color: v.string(),
	},
	handler: async (ctx, { token, name, color }) => {
		const user = await requireUser(ctx, token);
		const trimmed = name.trim();
		if (!trimmed) throw new Error("Project name is required");

		const projectId = await ctx.db.insert("projects", {
			name: trimmed,
			color,
			createdBy: user._id,
		});

		await ctx.db.insert("activities", {
			userId: user._id,
			entityType: "project",
			entityId: projectId,
			projectId,
			action: "created",
			details: trimmed,
		});

		return projectId;
	},
});

export const update = mutation({
	args: {
		token: v.string(),
		projectId: v.id("projects"),
		name: v.optional(v.string()),
		color: v.optional(v.string()),
	},
	handler: async (ctx, { token, projectId, name, color }) => {
		const user = await requireUser(ctx, token);
		const project = await ctx.db.get(projectId);
		if (!project) throw new Error("Project not found");

		const patch: Record<string, unknown> = {};
		const changes: string[] = [];
		if (name !== undefined && name.trim() && name.trim() !== project.name) {
			patch.name = name.trim();
			changes.push(`name: "${project.name}" → "${name.trim()}"`);
		}
		if (color !== undefined && color !== project.color) {
			patch.color = color;
			changes.push(`color: ${project.color} → ${color}`);
		}

		if (Object.keys(patch).length === 0) return;

		await ctx.db.patch(projectId, patch);
		await ctx.db.insert("activities", {
			userId: user._id,
			entityType: "project",
			entityId: projectId,
			projectId,
			action: "updated",
			details: changes.join(", "),
		});
	},
});

export const archive = mutation({
	args: { token: v.string(), projectId: v.id("projects") },
	handler: async (ctx, { token, projectId }) => {
		const user = await requireUser(ctx, token);
		const project = await ctx.db.get(projectId);
		if (!project) throw new Error("Project not found");

		await ctx.db.patch(projectId, { archivedAt: Date.now() });
		await ctx.db.insert("activities", {
			userId: user._id,
			entityType: "project",
			entityId: projectId,
			projectId,
			action: "archived",
		});
	},
});

export const unarchive = mutation({
	args: { token: v.string(), projectId: v.id("projects") },
	handler: async (ctx, { token, projectId }) => {
		const user = await requireUser(ctx, token);
		const project = await ctx.db.get(projectId);
		if (!project) throw new Error("Project not found");

		await ctx.db.patch(projectId, { archivedAt: undefined });
		await ctx.db.insert("activities", {
			userId: user._id,
			entityType: "project",
			entityId: projectId,
			projectId,
			action: "unarchived",
		});
	},
});
