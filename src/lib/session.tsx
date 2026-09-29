import { useConvexAuth, useQuery } from "convex/react";
import * as React from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { authClient } from "./auth-client";

export type SessionUser = {
	_id: Id<"users">;
	username: string;
	displayName: string;
};

type SessionContextValue = {
	user: SessionUser | null | undefined;
	isLoading: boolean;
	login: (username: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	changePassword: (
		currentPassword: string,
		newPassword: string,
	) => Promise<void>;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

function unwrap<T>(result: {
	data: T | null;
	error: { message?: string } | null;
}) {
	if (result.error) throw new Error(result.error.message || "Request failed");
	return result.data;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
	const user = useQuery(api.userAccounts.me, isAuthenticated ? {} : "skip");

	const login = React.useCallback(
		async (username: string, password: string) => {
			unwrap(await authClient.signIn.username({ username, password }));
		},
		[],
	);

	const logout = React.useCallback(async () => {
		await authClient.signOut();
	}, []);

	const changePassword = React.useCallback(
		async (currentPassword: string, newPassword: string) => {
			unwrap(
				await authClient.changePassword({
					currentPassword,
					newPassword,
					revokeOtherSessions: true,
				}),
			);
		},
		[],
	);

	const isLoading = authLoading || (isAuthenticated && user === undefined);

	const value = React.useMemo<SessionContextValue>(
		() => ({
			user: isAuthenticated ? user : null,
			isLoading,
			login,
			logout,
			changePassword,
		}),
		[isAuthenticated, user, isLoading, login, logout, changePassword],
	);

	return (
		<SessionContext.Provider value={value}>{children}</SessionContext.Provider>
	);
}

export function useSession() {
	const ctx = React.useContext(SessionContext);
	if (!ctx) throw new Error("useSession must be used within SessionProvider");
	return ctx;
}
