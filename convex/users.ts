"use node";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

function generatePassword() {
	return randomBytes(18).toString("base64url");
}

/**
 * Provision an account (sign-up is disabled in the app).
 *
 *   npx convex run users:create '{"username":"jane","displayName":"Jane"}'
 *
 * Omit `password` to generate one; it is returned once and never stored in
 * plain text.
 */
export const create = internalAction({
	args: {
		username: v.string(),
		displayName: v.string(),
		password: v.optional(v.string()),
	},
	handler: async (ctx, { username, displayName, password }) => {
		const plain = password ?? generatePassword();
		if (plain.length < 8) throw new Error("Password must be at least 8 characters");
		await ctx.runMutation(internal.userAccounts.insert, {
			username,
			displayName,
			passwordHash: bcrypt.hashSync(plain, 10),
		});
		return { username: username.trim().toLowerCase(), password: plain };
	},
});

/**
 *   npx convex run users:setPassword '{"username":"jane"}'
 */
export const setPassword = internalAction({
	args: { username: v.string(), password: v.optional(v.string()) },
	handler: async (ctx, { username, password }) => {
		const plain = password ?? generatePassword();
		if (plain.length < 8) throw new Error("Password must be at least 8 characters");
		await ctx.runMutation(internal.userAccounts.setPasswordHash, {
			username,
			passwordHash: bcrypt.hashSync(plain, 10),
		});
		return { username: username.trim().toLowerCase(), password: plain };
	},
});
