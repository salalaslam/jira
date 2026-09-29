// Server-only: forwards web-app requests to the Convex HTTP actions origin so
// auth cookies and OAuth/MCP endpoints all live on the app's own domain.

function convexSiteUrl() {
	const explicit = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
	if (explicit) return explicit.replace(/\/+$/, "");
	const cloud = import.meta.env.VITE_CONVEX_URL as string | undefined;
	if (!cloud) throw new Error("VITE_CONVEX_URL is not set");
	return cloud.replace(/\/+$/, "").replace(/\.convex\.cloud$/, ".convex.site");
}

export async function proxyToConvex(request: Request, pathname?: string) {
	const incoming = new URL(request.url);
	const siteUrl = convexSiteUrl();
	const target = `${siteUrl}${pathname ?? incoming.pathname}${incoming.search}`;

	const headers = new Headers(request.headers);
	for (const name of ["transfer-encoding", "content-length", "connection"]) {
		headers.delete(name);
	}
	headers.set("accept-encoding", "identity");
	if (incoming.pathname.startsWith("/api/auth/sign-in/")) {
		// Better Auth's MCP plugin would answer sign-in with a redirect to the
		// OAuth client when this cookie is present, which fetch() can't follow.
		// The login page resumes the authorize step itself instead.
		const cookie = headers.get("cookie");
		if (cookie) {
			headers.set(
				"cookie",
				cookie
					.split(/;\s*/)
					.filter(
						(pair) => !/^(__Secure-)?[\w.-]*oidc_login_prompt=/.test(pair),
					)
					.join("; "),
			);
		}
	}
	headers.set("host", new URL(siteUrl).host);
	const proto = incoming.protocol.replace(/:$/, "");
	headers.set("x-forwarded-host", incoming.host);
	headers.set("x-forwarded-proto", proto);
	headers.set("x-better-auth-forwarded-host", incoming.host);
	headers.set("x-better-auth-forwarded-proto", proto);

	const hasBody = request.method !== "GET" && request.method !== "HEAD";
	const response = await fetch(target, {
		method: request.method,
		headers,
		redirect: "manual",
		body: hasBody ? await request.arrayBuffer() : undefined,
	});

	// fetch already decoded the body; drop headers that no longer apply.
	const responseHeaders = new Headers(response.headers);
	responseHeaders.delete("content-encoding");
	responseHeaders.delete("content-length");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: responseHeaders,
	});
}
