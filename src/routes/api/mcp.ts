import { createFileRoute } from "@tanstack/react-router";
import { proxyToConvex } from "#/lib/convex-proxy";

// MCP endpoint for Claude and other clients; implemented in convex/http.ts.
export const Route = createFileRoute("/api/mcp")({
	server: {
		handlers: {
			GET: ({ request }) => proxyToConvex(request),
			POST: ({ request }) => proxyToConvex(request),
			DELETE: ({ request }) => proxyToConvex(request),
		},
	},
});
