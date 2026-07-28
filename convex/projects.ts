import { v } from "convex/values";
import { api } from "./_generated/api";
import {
	action,
	internalMutation,
	mutation,
	query,
} from "./_generated/server";
import { requireUser } from "./helpers";

function normalizeProjectLink(raw?: string) {
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
		throw new Error("Project link must be a valid URL");
	}

	if (!["http:", "https:"].includes(url.protocol)) {
		throw new Error("Project link must start with http:// or https://");
	}

	return url.toString();
}

function normalizeGithubRepo(raw?: string) {
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
		throw new Error("GitHub repo must be a valid URL");
	}

	if (!["http:", "https:"].includes(url.protocol)) {
		throw new Error("GitHub repo must start with http:// or https://");
	}

	const hostname = url.hostname.toLowerCase();
	if (
		(hostname !== "github.com" && hostname !== "www.github.com") ||
		url.port
	) {
		throw new Error("GitHub repo must be hosted on github.com");
	}

	url.protocol = "https:";
	return url.toString();
}

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
				const activities = await ctx.db
					.query("activities")
					.withIndex("by_project", (q) => q.eq("projectId", project._id))
					.collect();
				const active = todos.filter((t) => !t.archivedAt);
				const lastUpdatedAt = Math.max(
					project._creationTime,
					...todos.map((t) => t._creationTime),
					...activities.map((a) => a._creationTime),
				);
				return {
					...project,
					lastUpdatedAt,
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
			return b.lastUpdatedAt - a.lastUpdatedAt;
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
		link: v.optional(v.string()),
		githubRepo: v.optional(v.string()),
	},
	handler: async (ctx, { token, name, color, link, githubRepo }) => {
		const user = await requireUser(ctx, token);
		const trimmed = name.trim();
		const normalizedLink = normalizeProjectLink(link);
		const normalizedGithubRepo = normalizeGithubRepo(githubRepo);
		if (!trimmed) throw new Error("Project name is required");

		const projectId = await ctx.db.insert("projects", {
			name: trimmed,
			color,
			link: normalizedLink,
			githubRepo: normalizedGithubRepo,
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
		link: v.optional(v.string()),
		githubRepo: v.optional(v.string()),
	},
	handler: async (
		ctx,
		{ token, projectId, name, color, link, githubRepo },
	) => {
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
		if (link !== undefined) {
			const normalizedLink = normalizeProjectLink(link);
			const previousLink = (project as { link?: string }).link;
			if (normalizedLink !== previousLink) {
				patch.link = normalizedLink;
				changes.push(
					`link: ${previousLink ?? "(empty)"} → ${normalizedLink ?? "(empty)"}`,
				);
			}
		}
		if (githubRepo !== undefined) {
			const normalizedGithubRepo = normalizeGithubRepo(githubRepo);
			if (normalizedGithubRepo !== project.githubRepo) {
				patch.githubRepo = normalizedGithubRepo;
				changes.push(
					`githubRepo: ${project.githubRepo ?? "(empty)"} → ${normalizedGithubRepo ?? "(empty)"}`,
				);
			}
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

export const seedGithubRepos = internalMutation({
	args: {
		entries: v.array(
			v.object({
				name: v.string(),
				githubRepo: v.string(),
			}),
		),
		overwrite: v.optional(v.boolean()),
	},
	handler: async (ctx, { entries, overwrite }) => {
		const reposByProjectName = new Map(
			entries.map(({ name, githubRepo }) => [
				name.toLowerCase(),
				normalizeGithubRepo(githubRepo),
			]),
		);
		const projects = await ctx.db.query("projects").collect();
		let patched = 0;

		for (const project of projects) {
			if (project.archivedAt) continue;
			if (!overwrite && project.githubRepo !== undefined) continue;
			const githubRepo = reposByProjectName.get(project.name.toLowerCase());
			if (!githubRepo) continue;

			await ctx.db.patch(project._id, { githubRepo });
			patched += 1;
		}

		return { patched };
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

export const checkLinkStatuses = action({
	args: {
		token: v.string(),
		links: v.array(
			v.object({
				projectId: v.id("projects"),
				url: v.string(),
			}),
		),
	},
	handler: async (ctx, { token, links }) => {
		const user = await ctx.runQuery(api.auth.getMe, { token });
		if (!user) throw new Error("Not authenticated");
		const limitedLinks = links.slice(0, 50);
		const statuses = await Promise.all(
			limitedLinks.map(async ({ projectId, url }) => {
				try {
					const controller = new AbortController();
					const timeout = setTimeout(() => controller.abort(), 4000);
					const fetchOptions = {
						redirect: "follow" as const,
						signal: controller.signal,
					};
					let response: Response;
					try {
						response = await fetch(url, {
							method: "HEAD",
							...fetchOptions,
						});
						if (!response.ok) {
							response = await fetch(url, {
								method: "GET",
								...fetchOptions,
							});
						}
					} catch {
						response = await fetch(url, {
							method: "GET",
							...fetchOptions,
						});
					} finally {
						clearTimeout(timeout);
					}

					return {
						projectId,
						ok: response.ok,
						status: response.status,
					};
				} catch {
					return {
						projectId,
						ok: false,
						status: undefined,
					};
				}
			}),
		);

		return statuses;
	},
});
