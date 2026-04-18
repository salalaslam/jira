import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./helpers";

export const listForEntity = query({
	args: {
		token: v.string(),
		entityType: v.union(v.literal("project"), v.literal("todo")),
		entityId: v.string(),
	},
	handler: async (ctx, { token, entityType, entityId }) => {
		await requireUser(ctx, token);
		const rows = await ctx.db
			.query("activities")
			.withIndex("by_entity", (q) =>
				q.eq("entityType", entityType).eq("entityId", entityId),
			)
			.collect();

		const sorted = rows.sort((a, b) => b._creationTime - a._creationTime);
		return await Promise.all(
			sorted.map(async (a) => {
				const user = await ctx.db.get(a.userId);
				return {
					_id: a._id,
					_creationTime: a._creationTime,
					action: a.action,
					details: a.details,
					user: user
						? { displayName: user.displayName, username: user.username }
						: null,
				};
			}),
		);
	},
});

export const listForProject = query({
	args: { token: v.string(), projectId: v.id("projects") },
	handler: async (ctx, { token, projectId }) => {
		await requireUser(ctx, token);
		const rows = await ctx.db
			.query("activities")
			.withIndex("by_project", (q) => q.eq("projectId", projectId))
			.collect();

		const sorted = rows.sort((a, b) => b._creationTime - a._creationTime);
		return await Promise.all(
			sorted.map(async (a) => {
				const user = await ctx.db.get(a.userId);
				return {
					_id: a._id,
					_creationTime: a._creationTime,
					action: a.action,
					details: a.details,
					entityType: a.entityType,
					entityId: a.entityId,
					user: user
						? { displayName: user.displayName, username: user.username }
						: null,
				};
			}),
		);
	},
});
