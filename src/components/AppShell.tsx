import { Link, useLocation } from "@tanstack/react-router";
import {
	ArchiveIcon,
	FolderIcon,
	KeyRoundIcon,
	LogOutIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { ThemeToggle } from "#/components/ThemeToggle";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { useSession } from "#/lib/session";
import { cn } from "#/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
	const { user, logout } = useSession();
	const location = useLocation();
	const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);

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

					<div className="ml-auto flex items-center gap-1">
						<ThemeToggle />
						{user && (
							<>
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
											onSelect={() => {
												setPasswordDialogOpen(true);
											}}
										>
											<KeyRoundIcon className="h-4 w-4" />
											Change password
										</DropdownMenuItem>
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
								<ChangePasswordDialog
									open={passwordDialogOpen}
									onOpenChange={setPasswordDialogOpen}
								/>
							</>
						)}
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
		</div>
	);
}

function ChangePasswordDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { changePassword } = useSession();
	const [currentPassword, setCurrentPassword] = React.useState("");
	const [newPassword, setNewPassword] = React.useState("");
	const [confirmPassword, setConfirmPassword] = React.useState("");
	const [submitting, setSubmitting] = React.useState(false);

	React.useEffect(() => {
		if (!open) {
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setSubmitting(false);
		}
	}, [open]);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();

		if (newPassword !== confirmPassword) {
			toast.error("New passwords do not match");
			return;
		}

		setSubmitting(true);
		try {
			await changePassword(currentPassword, newPassword);
			toast.success("Password changed");
			onOpenChange(false);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Could not change password",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Change password</DialogTitle>
					<DialogDescription>
						Use your current password to set a new one.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor="current-password">Current password</Label>
						<Input
							id="current-password"
							type="password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							autoComplete="current-password"
							required
							autoFocus
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="new-password">New password</Label>
						<Input
							id="new-password"
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							autoComplete="new-password"
							minLength={6}
							required
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="confirm-password">Confirm new password</Label>
						<Input
							id="confirm-password"
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							autoComplete="new-password"
							minLength={6}
							required
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={submitting}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting ? "Changing..." : "Change password"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
