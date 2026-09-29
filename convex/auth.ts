import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { APIError, betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { mcp, username } from "better-auth/plugins";
import bcrypt from "bcryptjs";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

const siteUrl = () => process.env.SITE_URL ?? "http://localhost:3000";

// MCP clients register themselves (RFC 7591). Only accept redirect URIs of
// clients we expect, so a rogue registration can't silently receive codes.
const DEFAULT_MCP_REDIRECT_URIS = [
	"https://claude.ai/api/mcp/auth_callback",
	"https://claude.com/api/mcp/auth_callback",
];

function isAllowedMcpRedirectUri(raw: string) {
	const extra = (process.env.MCP_ALLOWED_REDIRECT_URIS ?? "")
		.split(",")
		.map((uri) => uri.trim())
		.filter(Boolean);
	if ([...DEFAULT_MCP_REDIRECT_URIS, ...extra].includes(raw)) return true;
	try {
		const url = new URL(raw);
		// Loopback redirects are for local clients (Claude Code, MCP Inspector).
		return (
			url.protocol === "http:" &&
			(url.hostname === "localhost" || url.hostname === "127.0.0.1")
		);
	} catch {
		return false;
	}
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
	betterAuth({
		baseURL: siteUrl(),
		trustedOrigins: [siteUrl()],
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			// Accounts are provisioned with `npx convex run users:create`.
			disableSignUp: true,
			// bcrypt keeps password hashes from the previous auth system valid.
			password: {
				hash: async (password) => bcrypt.hashSync(password, 10),
				verify: async ({ hash, password }) => bcrypt.compareSync(password, hash),
			},
		},
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/mcp/register") return;
				const uris: unknown = ctx.body?.redirect_uris;
				if (
					!Array.isArray(uris) ||
					uris.length === 0 ||
					!uris.every((uri) => typeof uri === "string" && isAllowedMcpRedirectUri(uri))
				) {
					throw new APIError("BAD_REQUEST", {
						error: "invalid_redirect_uri",
						error_description: "Redirect URI is not allowed for this server",
					});
				}
			}),
		},
		plugins: [
			username(),
			mcp({
				loginPage: "/login",
				resource: `${siteUrl()}/api/mcp`,
				oidcConfig: {
					loginPage: "/login",
					requirePKCE: true,
					accessTokenExpiresIn: 60 * 60,
					refreshTokenExpiresIn: 60 * 60 * 24 * 30,
				},
			}),
			convex({ authConfig }),
		],
	});
