import { Link, useLocation } from "@tanstack/react-router";
import { SparklesIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "#/components/ui/button";

const DISMISSED_KEY = "claude-connector-banner-dismissed";

export function ClaudeConnectorBanner() {
	const location = useLocation();
	// Hidden until mounted so the server render matches the client's.
	const [visible, setVisible] = React.useState(false);

	React.useEffect(() => {
		setVisible(window.localStorage.getItem(DISMISSED_KEY) !== "1");
	}, []);

	if (!visible || location.pathname === "/connect-claude") return null;

	function dismiss() {
		window.localStorage.setItem(DISMISSED_KEY, "1");
		setVisible(false);
	}

	return (
		<div className="mb-6 flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
			<SparklesIcon className="h-4 w-4 shrink-0 text-primary" />
			<p className="flex-1">
				<strong>New:</strong> manage tickets from Claude.{" "}
				<Link
					to="/connect-claude"
					className="font-medium underline underline-offset-4"
				>
					See how to connect
				</Link>
			</p>
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7"
				onClick={dismiss}
				aria-label="Dismiss"
			>
				<XIcon className="h-4 w-4" />
			</Button>
		</div>
	);
}
