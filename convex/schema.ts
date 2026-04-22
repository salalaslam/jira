import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	users: defineTable({
		username: v.string(),
		displayName: v.string(),
		passwordHash: v.string(),
	}).index("by_username", ["username"]),

	sessions: defineTable({
		userId: v.id("users"),
		token: v.string(),
		expiresAt: v.number(),
	})
		.index("by_token", ["token"])
		.index("by_user", ["userId"]),

	projects: defineTable({
		name: v.string(),
		color: v.string(),
		link: v.optional(v.string()),
		archivedAt: v.optional(v.number()),
		createdBy: v.id("users"),
	}).index("by_archived", ["archivedAt"]),

	todos: defineTable({
		projectId: v.id("projects"),
		title: v.string(),
		description: v.string(),
		status: v.union(
			v.literal("todo"),
			v.literal("in_progress"),
			v.literal("done"),
		),
		priority: v.union(
			v.literal("low"),
			v.literal("medium"),
			v.literal("high"),
		),
		archivedAt: v.optional(v.number()),
		createdBy: v.id("users"),
	})
		.index("by_project", ["projectId"])
		.index("by_project_archived", ["projectId", "archivedAt"]),

	activities: defineTable({
		userId: v.id("users"),
		entityType: v.union(v.literal("project"), v.literal("todo")),
		entityId: v.string(),
		projectId: v.optional(v.id("projects")),
		action: v.string(),
		details: v.optional(v.string()),
	})
		.index("by_entity", ["entityType", "entityId"])
		.index("by_project", ["projectId"]),
});
