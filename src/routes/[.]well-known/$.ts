import { createFileRoute } from "@tanstack/react-router";
import { proxyToConvex } from "#/lib/convex-proxy";

// OAuth discovery for MCP clients (RFC 8414 / RFC 9728). Clients may append
// the resource path (e.g. /oauth-protected-resource/api/mcp), so match by prefix.
const documents = [
	"oauth-authorization-server",
	"oauth-protected-resource",
	"openid-configuration",
];

export const Route = createFileRoute("/.well-known/$")({
	server: {
		handlers: {
			GET: ({ request, params }) => {
				const doc = documents.find(
					(name) =>
						params._splat === name || params._splat?.startsWith(`${name}/`),
				);
				if (!doc) return new Response("Not Found", { status: 404 });
				const target =
					doc === "openid-configuration" ? "oauth-authorization-server" : doc;
				return proxyToConvex(request, `/api/auth/.well-known/${target}`);
			},
		},
	},
});
