import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";
import { authComponent } from "./auth";

export type Ctx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

export type AppUser = {
	_id: Id<"users">;
	username: string;
	displayName: string;
};

export async function getUserByAuthId(
	ctx: Ctx,
	authUserId: string,
): Promise<AppUser | null> {
	const user = await ctx.db
		.query("users")
		.withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
		.first();
	if (!user) return null;
	return {
		_id: user._id,
		username: user.username,
		displayName: user.displayName,
	};
}

export async function getCurrentUser(ctx: Ctx): Promise<AppUser | null> {
	const authUser = await authComponent.safeGetAuthUser(ctx);
	if (!authUser) return null;
	return await getUserByAuthId(ctx, authUser._id);
}

export async function requireUser(ctx: Ctx): Promise<AppUser> {
	const user = await getCurrentUser(ctx);
	if (!user) throw new Error("Not authenticated");
	return user;
}

export async function requireUnlockedProject(
	ctx: Ctx,
	projectId: Id<"projects">,
) {
	const project = await ctx.db.get(projectId);
	if (!project) throw new Error("Project not found");
	if (project.lockedAt !== undefined) throw new Error("Project is locked");
	return project;
}
