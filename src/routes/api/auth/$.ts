import { createFileRoute } from "@tanstack/react-router";
import { proxyToConvex } from "#/lib/convex-proxy";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => proxyToConvex(request),
			POST: ({ request }) => proxyToConvex(request),
		},
	},
});
