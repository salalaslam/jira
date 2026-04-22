import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	ArchiveIcon,
	ArrowLeftIcon,
	CheckCircle2Icon,
	CheckIcon,
	ChevronRightIcon,
	CircleIcon,
	CopyIcon,
	Loader2Icon,
	MoreVerticalIcon,
	PencilIcon,
	PlusIcon,
	TimerIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { AuthGate } from "#/components/AuthGate";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Separator } from "#/components/ui/separator";
import { Textarea } from "#/components/ui/textarea";
import { useSession } from "#/lib/session";
import { cn, formatRelativeTime } from "#/lib/utils";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { colorClassForProject } from "./index";

type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";

type Todo = {
	_id: Id<"todos">;
	_creationTime: number;
	title: string;
	description: string;
	status: Status;
	priority: Priority;
	archivedAt?: number;
};

const STATUS_META: Record<Status, { label: string; icon: React.ReactNode }> = {
	todo: {
		label: "Todo",
		icon: <CircleIcon className="h-3.5 w-3.5 text-muted-foreground" />,
	},
	in_progress: {
		label: "In progress",
		icon: <TimerIcon className="h-3.5 w-3.5 text-amber-500" />,
	},
	done: {
		label: "Done",
		icon: <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" />,
	},
};

const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
	low: {
		label: "Low",
		className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
	},
	medium: {
		label: "Medium",
		className:
			"bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
	},
	high: {
		label: "High",
		className:
			"bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
	},
};

export const Route = createFileRoute("/projects/$projectId")({
	component: ProjectPage,
});

function ProjectPage() {
	return (
		<AuthGate>
			<ProjectDetail />
		</AuthGate>
	);
}

function ProjectDetail() {
	const { projectId } = useParams({ from: "/projects/$projectId" });
	const { token } = useSession();
	const typedId = projectId as Id<"projects">;

	const project = useQuery(
		api.projects.get,
		token ? { token, projectId: typedId } : "skip",
	);
	const todos = useQuery(
		api.todos.listByProject,
		token ? { token, projectId: typedId, includeArchived: false } : "skip",
	);
	const activity = useQuery(
		api.activities.listForProject,
		token ? { token, projectId: typedId } : "skip",
	);

	const [statusFilter, setStatusFilter] = React.useState<"all" | Status>("all");
	const [priorityFilter, setPriorityFilter] = React.useState<"all" | Priority>(
		"all",
	);
	const [createOpen, setCreateOpen] = React.useState(false);

	const filtered = React.useMemo(() => {
		if (!todos) return [];
		return todos.filter((t) => {
			if (statusFilter !== "all" && t.status !== statusFilter) return false;
			if (priorityFilter !== "all" && t.priority !== priorityFilter)
				return false;
			return true;
		});
	}, [todos, statusFilter, priorityFilter]);

	if (project === undefined) {
		return (
			<div className="grid place-items-center py-20">
				<Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (project === null) {
		return (
			<div className="flex flex-col items-center gap-2 py-20">
				<p>Project not found</p>
				<Link to="/" className="text-sm text-muted-foreground underline">
					Back to projects
				</Link>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
					<Link to="/" className="hover:text-foreground">
						Projects
					</Link>
					<ChevronRightIcon className="h-3 w-3" />
					<span className="text-foreground">{project.name}</span>
				</div>
				<div className="flex items-start justify-between gap-4 flex-wrap">
					<div className="flex items-center gap-3">
						<Link
							to="/"
							className="text-muted-foreground hover:text-foreground"
						>
							<ArrowLeftIcon className="h-4 w-4" />
						</Link>
						<span
							className={cn(
								"h-6 w-1.5 rounded-full",
								colorClassForProject(project.color),
							)}
						/>
						<h1 className="text-2xl font-semibold tracking-tight">
							{project.name}
							{project.archivedAt && (
								<Badge variant="secondary" className="ml-2 align-middle">
									Archived
								</Badge>
							)}
						</h1>
					</div>
					<Dialog open={createOpen} onOpenChange={setCreateOpen}>
						<DialogTrigger asChild>
							<Button>
								<PlusIcon className="h-4 w-4" />
								New todo
							</Button>
						</DialogTrigger>
						<CreateTodoDialog
							projectId={typedId}
							onClose={() => setCreateOpen(false)}
						/>
					</Dialog>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap items-center gap-2">
						<Select
							value={statusFilter}
							onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
						>
							<SelectTrigger className="w-40">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								<SelectItem value="todo">Todo</SelectItem>
								<SelectItem value="in_progress">In progress</SelectItem>
								<SelectItem value="done">Done</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={priorityFilter}
							onValueChange={(v) =>
								setPriorityFilter(v as typeof priorityFilter)
							}
						>
							<SelectTrigger className="w-40">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All priorities</SelectItem>
								<SelectItem value="high">High</SelectItem>
								<SelectItem value="medium">Medium</SelectItem>
								<SelectItem value="low">Low</SelectItem>
							</SelectContent>
						</Select>
						<div className="ml-auto text-xs text-muted-foreground">
							{todos ? `${filtered.length} of ${todos.length}` : ""}
						</div>
					</div>

					{todos === undefined ? (
						<div className="grid place-items-center rounded-lg border border-dashed py-20">
							<Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
						</div>
					) : filtered.length === 0 ? (
						<div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
							<p className="text-sm text-muted-foreground">
								{todos.length === 0
									? "No todos yet. Create the first one."
									: "No todos match the current filters."}
							</p>
							{todos.length === 0 && (
								<Button onClick={() => setCreateOpen(true)}>
									<PlusIcon className="h-4 w-4" />
									New todo
								</Button>
							)}
						</div>
					) : (
						<div className="flex flex-col gap-2">
							{filtered.map((t) => (
								<TodoRow key={t._id} todo={t} />
							))}
						</div>
					)}
				</div>

				<aside className="flex flex-col gap-3">
					<h3 className="text-sm font-medium">Activity</h3>
					<div className="rounded-lg border bg-card p-2">
						{activity === undefined ? (
							<div className="grid place-items-center py-6">
								<Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
							</div>
						) : activity.length === 0 ? (
							<p className="px-2 py-4 text-xs text-muted-foreground">
								No activity yet.
							</p>
						) : (
							<ul className="flex flex-col">
								{activity.slice(0, 30).map((a) => (
									<li
										key={a._id}
										className="flex flex-col gap-0.5 px-2 py-2 text-xs"
									>
										<div className="flex items-center gap-1.5">
											<span className="font-medium text-foreground">
												{a.user?.displayName ?? "Unknown"}
											</span>
											<span className="text-muted-foreground">
												{a.action} {a.entityType}
											</span>
										</div>
										{a.details && (
											<div className="text-muted-foreground truncate">
												{a.details}
											</div>
										)}
										<div className="text-[10px] text-muted-foreground">
											{formatRelativeTime(a._creationTime)}
										</div>
									</li>
								))}
							</ul>
						)}
					</div>
				</aside>
			</div>
		</div>
	);
}

function TodoRow({ todo }: { todo: Todo }) {
	const { token } = useSession();
	const update = useMutation(api.todos.update);
	const archive = useMutation(api.todos.archive);
	const [editOpen, setEditOpen] = React.useState(false);

	async function setStatus(status: Status) {
		if (!token) return;
		try {
			await update({ token, todoId: todo._id, status });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed");
		}
	}

	async function setPriority(priority: Priority) {
		if (!token) return;
		try {
			await update({ token, todoId: todo._id, priority });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed");
		}
	}

	async function copyDescription() {
		const text = todo.description?.trim();
		if (!text) {
			toast.error("No description to copy");
			return;
		}
		try {
			await navigator.clipboard.writeText(text);
			toast.success("Description copied");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to copy");
		}
	}

	return (
		<div className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/30">
			<button
				type="button"
				onClick={() => {
					const next: Status =
						todo.status === "todo"
							? "in_progress"
							: todo.status === "in_progress"
								? "done"
								: "todo";
					void setStatus(next);
				}}
				className="mt-0.5 shrink-0"
				title="Cycle status"
			>
				{STATUS_META[todo.status].icon}
			</button>
			<button
				type="button"
				onClick={() => setEditOpen(true)}
				className="flex-1 min-w-0 text-left"
			>
				<div
					className={cn(
						"font-medium leading-snug",
						todo.status === "done" &&
							"line-through text-muted-foreground decoration-muted-foreground/50",
					)}
				>
					{todo.title}
				</div>
				{todo.description && (
					<div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
						{todo.description}
					</div>
				)}
				<div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
					<span>{STATUS_META[todo.status].label}</span>
					<span>·</span>
					<span>Updated {formatRelativeTime(todo._creationTime)}</span>
				</div>
			</button>
			<div className="flex items-center gap-2">
				<Select
					value={todo.priority}
					onValueChange={(v) => void setPriority(v as Priority)}
				>
					<SelectTrigger
						className={cn(
							"h-7 w-24 border-0 px-2 text-xs font-medium",
							PRIORITY_META[todo.priority].className,
						)}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="high">High</SelectItem>
						<SelectItem value="medium">Medium</SelectItem>
						<SelectItem value="low">Low</SelectItem>
					</SelectContent>
				</Select>
				<div className="flex items-center gap-0.5">
					{todo.status !== "done" && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
							title="Mark as done"
							aria-label="Mark as done"
							onClick={() => void setStatus("done")}
						>
							<CheckIcon className="h-4 w-4" />
						</Button>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
							>
								<MoreVerticalIcon className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => setEditOpen(true)}>
							<PencilIcon className="h-4 w-4" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => void copyDescription()}
							disabled={!todo.description?.trim()}
						>
							<CopyIcon className="h-4 w-4" />
							Copy description
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={async () => {
								if (!token) return;
								try {
									await archive({ token, todoId: todo._id });
									toast.success("Todo archived");
								} catch (e) {
									toast.error(e instanceof Error ? e.message : "Failed");
								}
							}}
						>
							<ArchiveIcon className="h-4 w-4" />
							Archive
						</DropdownMenuItem>
					</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<EditTodoDialog todo={todo} onClose={() => setEditOpen(false)} />
			</Dialog>
		</div>
	);
}

function CreateTodoDialog({
	projectId,
	onClose,
}: {
	projectId: Id<"projects">;
	onClose: () => void;
}) {
	const { token } = useSession();
	const create = useMutation(api.todos.create);
	const [title, setTitle] = React.useState("");
	const [description, setDescription] = React.useState("");
	const [status, setStatus] = React.useState<Status>("todo");
	const [priority, setPriority] = React.useState<Priority>("medium");
	const [submitting, setSubmitting] = React.useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!token) return;
		setSubmitting(true);
		try {
			await create({ token, projectId, title, description, status, priority });
			toast.success("Todo created");
			setTitle("");
			setDescription("");
			setStatus("todo");
			setPriority("medium");
			onClose();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<DialogContent className="sm:max-w-lg">
			<DialogHeader>
				<DialogTitle>New todo</DialogTitle>
				<DialogDescription>Add a task to this project.</DialogDescription>
			</DialogHeader>
			<form onSubmit={onSubmit} className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="title">Title</Label>
					<Input
						id="title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						autoFocus
						required
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="description">Description (optional)</Label>
					<Textarea
						id="description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={3}
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="flex flex-col gap-2">
						<Label>Status</Label>
						<Select
							value={status}
							onValueChange={(v) => setStatus(v as Status)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="todo">Todo</SelectItem>
								<SelectItem value="in_progress">In progress</SelectItem>
								<SelectItem value="done">Done</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-2">
						<Label>Priority</Label>
						<Select
							value={priority}
							onValueChange={(v) => setPriority(v as Priority)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="high">High</SelectItem>
								<SelectItem value="medium">Medium</SelectItem>
								<SelectItem value="low">Low</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="ghost"
						onClick={onClose}
						disabled={submitting}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={submitting || !title.trim()}>
						{submitting && <Loader2Icon className="h-4 w-4 animate-spin" />}
						Create
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}

function EditTodoDialog({
	todo,
	onClose,
}: {
	todo: Todo;
	onClose: () => void;
}) {
	const { token } = useSession();
	const update = useMutation(api.todos.update);
	const activity = useQuery(
		api.activities.listForEntity,
		token
			? { token, entityType: "todo", entityId: todo._id as string }
			: "skip",
	);

	const [title, setTitle] = React.useState(todo.title);
	const [description, setDescription] = React.useState(todo.description);
	const [status, setStatus] = React.useState<Status>(todo.status);
	const [priority, setPriority] = React.useState<Priority>(todo.priority);
	const [submitting, setSubmitting] = React.useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!token) return;
		setSubmitting(true);
		try {
			await update({
				token,
				todoId: todo._id,
				title,
				description,
				status,
				priority,
			});
			toast.success("Todo updated");
			onClose();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<DialogContent className="sm:max-w-2xl">
			<DialogHeader>
				<DialogTitle>Edit todo</DialogTitle>
			</DialogHeader>
			<form onSubmit={onSubmit} className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="title-edit">Title</Label>
					<Input
						id="title-edit"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						required
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="description-edit">Description</Label>
					<Textarea
						id="description-edit"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={5}
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="flex flex-col gap-2">
						<Label>Status</Label>
						<Select
							value={status}
							onValueChange={(v) => setStatus(v as Status)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="todo">Todo</SelectItem>
								<SelectItem value="in_progress">In progress</SelectItem>
								<SelectItem value="done">Done</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-2">
						<Label>Priority</Label>
						<Select
							value={priority}
							onValueChange={(v) => setPriority(v as Priority)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="high">High</SelectItem>
								<SelectItem value="medium">Medium</SelectItem>
								<SelectItem value="low">Low</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<Separator />
				<div>
					<h4 className="mb-2 text-sm font-medium">History</h4>
					{activity === undefined ? (
						<Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
					) : activity.length === 0 ? (
						<p className="text-xs text-muted-foreground">No history yet.</p>
					) : (
						<ul className="flex flex-col gap-1.5 max-h-48 overflow-auto">
							{activity.map((a) => (
								<li key={a._id} className="text-xs">
									<span className="font-medium">
										{a.user?.displayName ?? "Unknown"}
									</span>{" "}
									<span className="text-muted-foreground">{a.action}</span>
									{a.details && (
										<span className="text-muted-foreground">
											{" "}
											— {a.details}
										</span>
									)}
									<span className="ml-1 text-muted-foreground">
										· {formatRelativeTime(a._creationTime)}
									</span>
								</li>
							))}
						</ul>
					)}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="ghost"
						onClick={onClose}
						disabled={submitting}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={submitting || !title.trim()}>
						{submitting && <Loader2Icon className="h-4 w-4 animate-spin" />}
						Save
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}
