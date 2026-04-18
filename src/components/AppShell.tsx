import { Link, useLocation } from "@tanstack/react-router";
import { ArchiveIcon, FolderIcon, LogOutIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useSession } from "#/lib/session";
import { cn } from "#/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
	const { user, logout } = useSession();
	const location = useLocation();

	const nav = [
		{ to: "/", label: "Projects", icon: FolderIcon },
		{ to: "/archived", label: "Archive", icon: ArchiveIcon },
	];

	return (
		<div className="min-h-full bg-background">
			<header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
				<div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
					<Link to="/" className="flex items-center gap-2">
						<div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
							B
						</div>
						<span className="font-semibold tracking-tight">byome · tasks</span>
					</Link>

					<nav className="flex items-center gap-1">
						{nav.map((item) => {
							const Icon = item.icon;
							const active =
								item.to === "/"
									? location.pathname === "/"
									: location.pathname.startsWith(item.to);
							return (
								<Link
									key={item.to}
									to={item.to}
									className={cn(
										"inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
										active
											? "bg-secondary text-secondary-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									<Icon className="h-4 w-4" />
									{item.label}
								</Link>
							);
						})}
					</nav>

					<div className="ml-auto">
						{user && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="sm" className="gap-2">
										<div className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs font-semibold">
											{user.displayName.charAt(0).toUpperCase()}
										</div>
										<span>{user.displayName}</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-48">
									<DropdownMenuLabel className="font-normal">
										<div className="flex flex-col">
											<span className="font-medium">{user.displayName}</span>
											<span className="text-xs text-muted-foreground">
												@{user.username}
											</span>
										</div>
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => {
											void logout();
										}}
										className="text-destructive focus:text-destructive"
									>
										<LogOutIcon className="h-4 w-4" />
										Sign out
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
		</div>
	);
}
