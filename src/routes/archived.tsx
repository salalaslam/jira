import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	ArchiveRestoreIcon,
	CheckCircle2Icon,
	CircleIcon,
	Loader2Icon,
	TimerIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "#/components/AuthGate";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Separator } from "#/components/ui/separator";
import { useSession } from "#/lib/session";
import { cn, formatRelativeTime } from "#/lib/utils";
import { api } from "../../convex/_generated/api";
import { colorClassForProject } from "./index";

export const Route = createFileRoute("/archived")({
	component: ArchivedPage,
});

function ArchivedPage() {
	return (
		<AuthGate>
			<ArchivedView />
		</AuthGate>
	);
}

function ArchivedView() {
	const { token } = useSession();

	const projects = useQuery(
		api.projects.list,
		token ? { token, includeArchived: true } : "skip",
	);
	const archivedTodos = useQuery(
		api.todos.listArchived,
		token ? { token } : "skip",
	);

	const unarchiveProject = useMutation(api.projects.unarchive);
	const unarchiveTodo = useMutation(api.todos.unarchive);

	const archivedProjects = projects?.filter((p) => !!p.archivedAt) ?? [];

	const isLoading = projects === undefined || archivedTodos === undefined;

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Archive</h1>
				<p className="text-sm text-muted-foreground">
					Archived projects and todos. Nothing is ever deleted.
				</p>
			</div>

			{isLoading ? (
				<div className="grid place-items-center rounded-lg border border-dashed py-20">
					<Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			) : (
				<>
					<section className="flex flex-col gap-2">
						<h2 className="text-sm font-medium">
							Archived projects{" "}
							<span className="text-muted-foreground font-normal">
								({archivedProjects.length})
							</span>
						</h2>
						{archivedProjects.length === 0 ? (
							<p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
								No archived projects.
							</p>
						) : (
							<div className="flex flex-col gap-2">
								{archivedProjects.map((p) => (
									<div
										key={p._id}
										className="flex items-center gap-3 rounded-lg border bg-card p-3"
									>
										<span
											className={cn(
												"h-6 w-1.5 rounded-full shrink-0",
												colorClassForProject(p.color),
											)}
										/>
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">{p.name}</div>
											<div className="text-xs text-muted-foreground">
												Archived{" "}
												{p.archivedAt ? formatRelativeTime(p.archivedAt) : ""}
											</div>
										</div>
										<Link
											to="/projects/$projectId"
											params={{ projectId: p._id }}
											className="text-xs text-muted-foreground hover:text-foreground"
										>
											View
										</Link>
										<Button
											variant="outline"
											size="sm"
											onClick={async () => {
												if (!token) return;
												try {
													await unarchiveProject({ token, projectId: p._id });
													toast.success("Project restored");
												} catch (e) {
													toast.error(
														e instanceof Error ? e.message : "Failed",
													);
												}
											}}
										>
											<ArchiveRestoreIcon className="h-4 w-4" />
											Restore
										</Button>
									</div>
								))}
							</div>
						)}
					</section>

					<Separator />

					<section className="flex flex-col gap-2">
						<h2 className="text-sm font-medium">
							Archived todos{" "}
							<span className="text-muted-foreground font-normal">
								({archivedTodos?.length ?? 0})
							</span>
						</h2>
						{!archivedTodos || archivedTodos.length === 0 ? (
							<p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
								No archived todos.
							</p>
						) : (
							<div className="flex flex-col gap-2">
								{archivedTodos.map((t) => (
									<div
										key={t._id}
										className="flex items-start gap-3 rounded-lg border bg-card p-3"
									>
										<div className="mt-0.5 shrink-0">
											{t.status === "todo" && (
												<CircleIcon className="h-3.5 w-3.5 text-muted-foreground" />
											)}
											{t.status === "in_progress" && (
												<TimerIcon className="h-3.5 w-3.5 text-amber-500" />
											)}
											{t.status === "done" && (
												<CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" />
											)}
										</div>
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">{t.title}</div>
											<div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
												{t.project && (
													<>
														<span
															className={cn(
																"h-2 w-2 rounded-full",
																colorClassForProject(t.project.color),
															)}
														/>
														<Link
															to="/projects/$projectId"
															params={{ projectId: t.projectId }}
															className="hover:text-foreground"
														>
															{t.project.name}
														</Link>
														<span>·</span>
													</>
												)}
												<span>
													Archived{" "}
													{t.archivedAt ? formatRelativeTime(t.archivedAt) : ""}
												</span>
											</div>
										</div>
										<Badge variant="secondary" className="uppercase">
											{t.priority}
										</Badge>
										<Button
											variant="outline"
											size="sm"
											onClick={async () => {
												if (!token) return;
												try {
													await unarchiveTodo({ token, todoId: t._id });
													toast.success("Todo restored");
												} catch (e) {
													toast.error(
														e instanceof Error ? e.message : "Failed",
													);
												}
											}}
										>
											<ArchiveRestoreIcon className="h-4 w-4" />
											Restore
										</Button>
									</div>
								))}
							</div>
						)}
					</section>
				</>
			)}
		</div>
	);
}
