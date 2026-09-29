import { createFileRoute } from "@tanstack/react-router";
import { CheckIcon, CopyIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { AuthGate } from "#/components/AuthGate";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { useSession } from "#/lib/session";

export const Route = createFileRoute("/connect-claude")({
	component: ConnectClaudePage,
});

function ConnectClaudePage() {
	return (
		<AuthGate>
			<ConnectClaudeGuide />
		</AuthGate>
	);
}

const examples = [
	"List my projects",
	"Show all open high-priority tickets",
	"What's the latest on the checkout ticket?",
	"Create a ticket in Website: 'Update pricing copy', medium priority",
	"Mark that one done",
	"Cancel it, reason: duplicate",
];

function ConnectClaudeGuide() {
	const { user } = useSession();
	const [connectorUrl, setConnectorUrl] = React.useState("");
	const [copied, setCopied] = React.useState(false);

	React.useEffect(() => {
		setConnectorUrl(`${window.location.origin}/api/mcp`);
	}, []);

	async function copyUrl() {
		try {
			await navigator.clipboard.writeText(connectorUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Couldn't copy. Select the URL and copy it manually.");
		}
	}

	return (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">
					Use tasks from Claude
				</h1>
				<p className="text-sm text-muted-foreground">
					Ask Claude to look up, create and update tickets for you. It acts as
					you, so changes show up in the activity feed under your name.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Connect once (about a minute)
					</CardTitle>
					<CardDescription>
						Works in Claude on the web, desktop and mobile.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
						<li>
							In Claude, open <strong>Settings → Connectors</strong> and click{" "}
							<strong>Add custom connector</strong>.
						</li>
						<li>
							<div className="flex flex-col gap-2">
								<span>
									Name it <strong>Tasks</strong> and paste this URL. Leave the
									advanced settings empty.
								</span>
								<div className="flex items-center gap-2">
									<code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-xs">
										{connectorUrl || "…"}
									</code>
									<Button
										variant="outline"
										size="sm"
										onClick={copyUrl}
										disabled={!connectorUrl}
									>
										{copied ? (
											<CheckIcon className="h-4 w-4" />
										) : (
											<CopyIcon className="h-4 w-4" />
										)}
										{copied ? "Copied" : "Copy"}
									</Button>
								</div>
							</div>
						</li>
						<li>
							Click <strong>Add</strong>, then <strong>Connect</strong>.
						</li>
						<li>
							Sign in with your tasks username
							{user ? (
								<>
									{" "}
									(<code className="font-mono">{user.username}</code>)
								</>
							) : null}{" "}
							and password. You're sent back to Claude, connected.
						</li>
					</ol>
					<p className="mt-4 text-xs text-muted-foreground">
						On a Claude Team or Enterprise plan, an owner may need to add the
						connector for the workspace first. After that you only need to click
						Connect and sign in.
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Then just ask</CardTitle>
					<CardDescription>
						Make sure <strong>Tasks</strong> is switched on in the chat's tools
						menu.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4 text-sm">
					<ul className="flex flex-col gap-1.5">
						{examples.map((example) => (
							<li
								key={example}
								className="rounded-md bg-muted/60 px-3 py-1.5 text-muted-foreground"
							>
								“{example}”
							</li>
						))}
					</ul>
					<p>
						Claude may ask your permission before creating or changing a ticket,
						and replies with a link to it.
					</p>
					<div className="grid gap-3 sm:grid-cols-2">
						<div>
							<p className="font-medium">It can</p>
							<p className="text-muted-foreground">
								List projects, find and read tickets, create tickets, and change
								a ticket's title, description, status, priority or link.
							</p>
						</div>
						<div>
							<p className="font-medium">It can't</p>
							<p className="text-muted-foreground">
								Delete or archive anything, change projects, or edit locked
								projects.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Troubleshooting</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
					<p>
						<strong className="text-foreground">Password rejected:</strong> use
						the same login as this site. Ask an admin to reset it if needed.
					</p>
					<p>
						<strong className="text-foreground">
							Claude says to reconnect:
						</strong>{" "}
						open Settings → Connectors and click Connect again. This happens
						after a password change.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
