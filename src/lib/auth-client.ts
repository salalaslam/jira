import { convexClient } from "@convex-dev/better-auth/client/plugins";
import type { AuthClient } from "@convex-dev/better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [usernameClient(), convexClient()],
});

// ConvexBetterAuthProvider's AuthClient type rejects extra client plugins
// (username) even though they work at runtime.
export const convexAuthClient = authClient as unknown as AuthClient;
