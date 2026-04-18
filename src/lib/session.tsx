import { useConvex, useMutation, useQuery } from "convex/react";
import * as React from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getStoredToken, setStoredToken } from "./auth";

export type SessionUser = {
	_id: Id<"users">;
	username: string;
	displayName: string;
};

type SessionContextValue = {
	token: string | null;
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

export function SessionProvider({ children }: { children: React.ReactNode }) {
	const [token, setToken] = React.useState<string | null>(() =>
		getStoredToken(),
	);
	const [hydrated, setHydrated] = React.useState(false);

	React.useEffect(() => {
		setToken(getStoredToken());
		setHydrated(true);
	}, []);

	const user = useQuery(
		api.auth.getMe,
		hydrated ? { token: token ?? undefined } : "skip",
	);

	const loginMut = useMutation(api.auth.login);
	const logoutMut = useMutation(api.auth.logout);
	const changePasswordMut = useMutation(api.auth.changePassword);
	const convex = useConvex();

	const login = React.useCallback(
		async (username: string, password: string) => {
			const result = await loginMut({ username, password });
			setStoredToken(result.token);
			setToken(result.token);
		},
		[loginMut],
	);

	const logout = React.useCallback(async () => {
		if (token) {
			try {
				await logoutMut({ token });
			} catch {
				// ignore
			}
		}
		setStoredToken(null);
		setToken(null);
		await convex.close();
	}, [logoutMut, token, convex]);

	const changePassword = React.useCallback(
		async (currentPassword: string, newPassword: string) => {
			if (!token) {
				throw new Error("No active session");
			}

			await changePasswordMut({ token, currentPassword, newPassword });
		},
		[changePasswordMut, token],
	);

	const isLoading = !hydrated || (token !== null && user === undefined);

	const value = React.useMemo<SessionContextValue>(
		() => ({
			token,
			user: token ? user : null,
			isLoading,
			login,
			logout,
			changePassword,
		}),
		[token, user, isLoading, login, logout, changePassword],
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

export function useRequireToken(): string {
	const { token } = useSession();
	if (!token) throw new Error("No session token");
	return token;
}
