import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";

export type Ctx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

export async function requireUser(ctx: Ctx, token: string) {
	const session = await ctx.db
		.query("sessions")
		.withIndex("by_token", (q) => q.eq("token", token))
		.first();

	if (!session || session.expiresAt < Date.now()) {
		throw new Error("Not authenticated");
	}

	const user = await ctx.db.get(session.userId);
	if (!user) throw new Error("User not found");

	return {
		_id: user._id as Id<"users">,
		username: user.username,
		displayName: user.displayName,
	};
}
