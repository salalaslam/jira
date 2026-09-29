import { v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, query } from "./_generated/server";
import { getCurrentUser } from "./helpers";

// Better Auth requires an email; accounts sign in by username only.
const placeholderEmail = (username: string) => `${username}@users.invalid`;

export const me = query({
	args: {},
	handler: async (ctx) => await getCurrentUser(ctx),
});

async function createAuthUser(
	ctx: MutationCtx,
	appUserId: Id<"users">,
	username: string,
	displayName: string,
	passwordHash: string,
) {
	const now = Date.now();
	const authUser = await ctx.runMutation(components.betterAuth.adapter.create, {
		input: {
			model: "user",
			data: {
				name: displayName,
				email: placeholderEmail(username),
				emailVerified: false,
				username,
				displayUsername: username,
				userId: appUserId,
				createdAt: now,
				updatedAt: now,
			},
		},
	});
	const authUserId = authUser._id as string;
	await ctx.runMutation(components.betterAuth.adapter.create, {
		input: {
			model: "account",
			data: {
				accountId: authUserId,
				providerId: "credential",
				userId: authUserId,
				password: passwordHash,
				createdAt: now,
				updatedAt: now,
			},
		},
	});
	await ctx.db.patch(appUserId, { authUserId, passwordHash: undefined });
	return authUserId;
}

export const insert = internalMutation({
	args: {
		username: v.string(),
		displayName: v.string(),
		passwordHash: v.string(),
	},
	handler: async (ctx, { username, displayName, passwordHash }) => {
		const normalized = username.trim().toLowerCase();
		if (!/^[a-z0-9_.]{3,30}$/.test(normalized)) {
			throw new Error("Username must be 3-30 chars of a-z, 0-9, _ or .");
		}
		const existing = await ctx.db
			.query("users")
			.withIndex("by_username", (q) => q.eq("username", normalized))
			.first();
		if (existing?.authUserId) throw new Error("User already exists");

		const appUserId =
			existing?._id ??
			(await ctx.db.insert("users", { username: normalized, displayName }));
		await createAuthUser(ctx, appUserId, normalized, displayName, passwordHash);
	},
});

export const setPasswordHash = internalMutation({
	args: { username: v.string(), passwordHash: v.string() },
	handler: async (ctx, { username, passwordHash }) => {
		const normalized = username.trim().toLowerCase();
		const user = await ctx.db
			.query("users")
			.withIndex("by_username", (q) => q.eq("username", normalized))
			.first();
		if (!user?.authUserId) throw new Error("User not found");
		await ctx.runMutation(components.betterAuth.adapter.updateOne, {
			input: {
				model: "account",
				where: [
					{ field: "userId", value: user.authUserId },
					{ field: "providerId", value: "credential" },
				],
				update: { password: passwordHash, updatedAt: Date.now() },
			},
		});
		// Sign out everywhere, including MCP clients.
		await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
			input: {
				model: "session",
				where: [{ field: "userId", value: user.authUserId }],
			},
			paginationOpts: { cursor: null, numItems: 1000 },
		});
		await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
			input: {
				model: "oauthAccessToken",
				where: [{ field: "userId", value: user.authUserId }],
			},
			paginationOpts: { cursor: null, numItems: 1000 },
		});
	},
});

/**
 * One-time move from the legacy username/bcrypt/session-token auth to Better
 * Auth. Existing password hashes carry over, so nobody needs a reset.
 *
 *   npx convex run userAccounts:migrateLegacyUsers
 */
export const migrateLegacyUsers = internalMutation({
	args: {},
	handler: async (ctx) => {
		const migrated: string[] = [];
		for (const user of await ctx.db.query("users").collect()) {
			if (user.authUserId || !user.passwordHash) continue;
			await createAuthUser(
				ctx,
				user._id,
				user.username,
				user.displayName,
				user.passwordHash,
			);
			migrated.push(user.username);
		}
		let legacySessions = 0;
		for (const session of await ctx.db.query("sessions").collect()) {
			await ctx.db.delete(session._id);
			legacySessions += 1;
		}
		return { migrated, legacySessionsDeleted: legacySessions };
	},
});
