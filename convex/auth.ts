import bcrypt from "bcryptjs";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./helpers";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function randomToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const login = mutation({
	args: {
		username: v.string(),
		password: v.string(),
	},
	handler: async (ctx, { username, password }) => {
		const normalized = username.trim().toLowerCase();
		const user = await ctx.db
			.query("users")
			.withIndex("by_username", (q) => q.eq("username", normalized))
			.first();

		if (!user) {
			throw new Error("Invalid credentials");
		}

		const ok = bcrypt.compareSync(password, user.passwordHash);
		if (!ok) {
			throw new Error("Invalid credentials");
		}

		const token = randomToken();
		await ctx.db.insert("sessions", {
			userId: user._id,
			token,
			expiresAt: Date.now() + SESSION_DURATION_MS,
		});

		return {
			token,
			user: {
				_id: user._id,
				username: user.username,
				displayName: user.displayName,
			},
		};
	},
});

export const logout = mutation({
	args: { token: v.string() },
	handler: async (ctx, { token }) => {
		const session = await ctx.db
			.query("sessions")
			.withIndex("by_token", (q) => q.eq("token", token))
			.first();
		if (session) {
			await ctx.db.delete(session._id);
		}
		return null;
	},
});

export const getMe = query({
	args: { token: v.optional(v.string()) },
	handler: async (ctx, { token }) => {
		if (!token) return null;
		const session = await ctx.db
			.query("sessions")
			.withIndex("by_token", (q) => q.eq("token", token))
			.first();

		if (!session || session.expiresAt < Date.now()) {
			return null;
		}

		const user = await ctx.db.get(session.userId);
		if (!user) return null;

		return {
			_id: user._id,
			username: user.username,
			displayName: user.displayName,
		};
	},
});

export const seedUsers = mutation({
	args: {
		users: v.array(
			v.object({
				username: v.string(),
				displayName: v.string(),
				password: v.string(),
			}),
		),
	},
	handler: async (ctx, { users }) => {
		const results: Array<{ username: string; status: string }> = [];
		for (const u of users) {
			const normalized = u.username.trim().toLowerCase();
			const existing = await ctx.db
				.query("users")
				.withIndex("by_username", (q) => q.eq("username", normalized))
				.first();

			const passwordHash = bcrypt.hashSync(u.password, 10);

			if (existing) {
				await ctx.db.patch(existing._id, {
					displayName: u.displayName,
					passwordHash,
				});
				results.push({ username: normalized, status: "updated" });
			} else {
				await ctx.db.insert("users", {
					username: normalized,
					displayName: u.displayName,
					passwordHash,
				});
				results.push({ username: normalized, status: "created" });
			}
		}
		return results;
	},
});

export const changePassword = mutation({
	args: {
		token: v.string(),
		currentPassword: v.string(),
		newPassword: v.string(),
	},
	handler: async (ctx, { token, currentPassword, newPassword }) => {
		const user = await requireUser(ctx, token);
		const fullUser = await ctx.db.get(user._id);
		if (!fullUser) throw new Error("User missing");

		const ok = bcrypt.compareSync(currentPassword, fullUser.passwordHash);
		if (!ok) throw new Error("Current password is incorrect");

		if (newPassword.length < 6) {
			throw new Error("New password must be at least 6 characters");
		}

		const passwordHash = bcrypt.hashSync(newPassword, 10);
		await ctx.db.patch(user._id, { passwordHash });
		return { success: true };
	},
});
