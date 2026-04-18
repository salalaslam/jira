import { Navigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useSession } from "#/lib/session";
import { AppShell } from "./AppShell";

export function AuthGate({ children }: { children: React.ReactNode }) {
	const { user, isLoading } = useSession();

	if (isLoading) {
		return (
			<div className="grid min-h-screen place-items-center">
				<Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/login" />;
	}

	return <AppShell>{children}</AppShell>;
}
