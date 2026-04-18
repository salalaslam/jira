import {
	createFileRoute,
	Link,
	Navigate,
	useNavigate,
} from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { useSession } from "#/lib/session";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const { login, user, isLoading } = useSession();
	const navigate = useNavigate();
	const [username, setUsername] = React.useState("");
	const [password, setPassword] = React.useState("");
	const [submitting, setSubmitting] = React.useState(false);

	if (!isLoading && user) {
		return <Navigate to="/" />;
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		try {
			await login(username, password);
			toast.success(`Welcome back, ${username}`);
			void navigate({ to: "/" });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Login failed");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="grid min-h-screen place-items-center bg-muted/30 px-4">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
						B
					</div>
					<CardTitle className="text-xl">byome · tasks</CardTitle>
					<CardDescription>Sign in to manage your projects</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={onSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="username">Username</Label>
							<Input
								id="username"
								placeholder="thomas or salal"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								autoComplete="username"
								required
								autoFocus
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								autoComplete="current-password"
								required
							/>
						</div>
						<Button type="submit" disabled={submitting} className="mt-2">
							{submitting && <Loader2Icon className="h-4 w-4 animate-spin" />}
							Sign in
						</Button>
					</form>
					<p className="mt-6 text-center text-xs text-muted-foreground">
						No account yet? Run{" "}
						<code className="rounded bg-muted px-1.5 py-0.5 font-mono">
							pnpm seed
						</code>{" "}
						to create users.
					</p>
					<div className="mt-2 text-center">
						<Link
							to="/"
							className="text-xs text-muted-foreground hover:text-foreground"
						>
							Back
						</Link>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
