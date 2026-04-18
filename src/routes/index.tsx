import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	ArchiveIcon,
	CheckCircle2Icon,
	CircleIcon,
	Loader2Icon,
	MoreVerticalIcon,
	PencilIcon,
	PlusIcon,
	SearchIcon,
	TimerIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { AuthGate } from "#/components/AuthGate";
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
import { useSession } from "#/lib/session";
import { cn, formatRelativeTime } from "#/lib/utils";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/")({ component: IndexPage });

const PROJECT_COLORS = [
	{ value: "slate", className: "bg-slate-500" },
	{ value: "rose", className: "bg-rose-500" },
	{ value: "orange", className: "bg-orange-500" },
	{ value: "amber", className: "bg-amber-500" },
	{ value: "emerald", className: "bg-emerald-500" },
	{ value: "teal", className: "bg-teal-500" },
	{ value: "sky", className: "bg-sky-500" },
	{ value: "indigo", className: "bg-indigo-500" },
	{ value: "violet", className: "bg-violet-500" },
	{ value: "fuchsia", className: "bg-fuchsia-500" },
];

export function colorClassForProject(color: string) {
	return (
		PROJECT_COLORS.find((c) => c.value === color)?.className ?? "bg-slate-500"
	);
}

function IndexPage() {
	return (
		<AuthGate>
			<ProjectsDashboard />
		</AuthGate>
	);
}

function ProjectsDashboard() {
	const { token } = useSession();
	const projects = useQuery(
		api.projects.list,
		token ? { token, includeArchived: false } : "skip",
	);
	const [search, setSearch] = React.useState("");
	const [createOpen, setCreateOpen] = React.useState(false);

	const filtered = React.useMemo(() => {
		if (!projects) return [];
		const q = search.trim().toLowerCase();
		if (!q) return projects;
		return projects.filter((p) => p.name.toLowerCase().includes(q));
	}, [projects, search]);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-end justify-between gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
					<p className="text-sm text-muted-foreground">
						{projects
							? `${projects.length} active ${projects.length === 1 ? "project" : "projects"}`
							: "Loading…"}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="relative">
						<SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Search projects…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-8 w-56"
						/>
					</div>
					<Dialog open={createOpen} onOpenChange={setCreateOpen}>
						<DialogTrigger asChild>
							<Button>
								<PlusIcon className="h-4 w-4" />
								New project
							</Button>
						</DialogTrigger>
						<CreateProjectDialog onClose={() => setCreateOpen(false)} />
					</Dialog>
				</div>
			</div>

			{!projects ? (
				<div className="grid place-items-center rounded-lg border border-dashed py-20">
					<Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			) : filtered.length === 0 ? (
				<EmptyState
					title={search ? "No matches" : "No projects yet"}
					description={
						search
							? "Try a different search term."
							: "Create your first project to start tracking todos."
					}
					action={
						!search && (
							<Button onClick={() => setCreateOpen(true)}>
								<PlusIcon className="h-4 w-4" />
								New project
							</Button>
						)
					}
				/>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{filtered.map((p) => (
						<ProjectCard key={p._id} project={p} />
					))}
				</div>
			)}
		</div>
	);
}

function ProjectCard({
	project,
}: {
	project: {
		_id: Id<"projects">;
		_creationTime: number;
		name: string;
		color: string;
		counts: { total: number; todo: number; inProgress: number; done: number };
	};
}) {
	const { token } = useSession();
	const archive = useMutation(api.projects.archive);
	const [editOpen, setEditOpen] = React.useState(false);

	const { counts } = project;

	return (
		<div className="group relative flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-xs transition-all hover:border-primary/30 hover:shadow-sm">
			<div className="flex items-start justify-between gap-2">
				<Link
					to="/projects/$projectId"
					params={{ projectId: project._id }}
					className="flex items-center gap-2.5 flex-1 min-w-0"
				>
					<span
						className={cn(
							"h-8 w-1 rounded-full shrink-0",
							colorClassForProject(project.color),
						)}
					/>
					<div className="min-w-0">
						<div className="font-medium truncate">{project.name}</div>
						<div className="text-xs text-muted-foreground">
							Created {formatRelativeTime(project._creationTime)}
						</div>
					</div>
				</Link>
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
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={async () => {
								if (!token) return;
								try {
									await archive({ token, projectId: project._id });
									toast.success("Project archived");
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

			<Link
				to="/projects/$projectId"
				params={{ projectId: project._id }}
				className="flex items-center gap-4 text-sm"
			>
				<StatPill
					icon={<CircleIcon className="h-3.5 w-3.5 text-muted-foreground" />}
					label="Todo"
					value={counts.todo}
				/>
				<StatPill
					icon={<TimerIcon className="h-3.5 w-3.5 text-amber-500" />}
					label="Doing"
					value={counts.inProgress}
				/>
				<StatPill
					icon={<CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" />}
					label="Done"
					value={counts.done}
				/>
			</Link>

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<EditProjectDialog
					project={project}
					onClose={() => setEditOpen(false)}
				/>
			</Dialog>
		</div>
	);
}

function StatPill({
	icon,
	label,
	value,
}: {
	icon: React.ReactNode;
	label: string;
	value: number;
}) {
	return (
		<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
			{icon}
			<span>{label}</span>
			<span className="font-medium text-foreground tabular-nums">{value}</span>
		</div>
	);
}

function EmptyState({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-20 text-center">
			<h3 className="font-medium">{title}</h3>
			<p className="text-sm text-muted-foreground max-w-xs">{description}</p>
			{action}
		</div>
	);
}

function CreateProjectDialog({ onClose }: { onClose: () => void }) {
	const { token } = useSession();
	const create = useMutation(api.projects.create);
	const [name, setName] = React.useState("");
	const [color, setColor] = React.useState("sky");
	const [submitting, setSubmitting] = React.useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!token) return;
		setSubmitting(true);
		try {
			await create({ token, name, color });
			toast.success("Project created");
			setName("");
			onClose();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<DialogContent className="sm:max-w-md">
			<DialogHeader>
				<DialogTitle>New project</DialogTitle>
				<DialogDescription>
					Each project holds its own list of todos.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={onSubmit} className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="name">Name</Label>
					<Input
						id="name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						autoFocus
						placeholder="e.g. Acme Corp"
						required
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label>Color</Label>
					<ColorPicker value={color} onChange={setColor} />
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
					<Button type="submit" disabled={submitting || !name.trim()}>
						{submitting && <Loader2Icon className="h-4 w-4 animate-spin" />}
						Create
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}

function EditProjectDialog({
	project,
	onClose,
}: {
	project: { _id: Id<"projects">; name: string; color: string };
	onClose: () => void;
}) {
	const { token } = useSession();
	const update = useMutation(api.projects.update);
	const [name, setName] = React.useState(project.name);
	const [color, setColor] = React.useState(project.color);
	const [submitting, setSubmitting] = React.useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!token) return;
		setSubmitting(true);
		try {
			await update({ token, projectId: project._id, name, color });
			toast.success("Project updated");
			onClose();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<DialogContent className="sm:max-w-md">
			<DialogHeader>
				<DialogTitle>Edit project</DialogTitle>
			</DialogHeader>
			<form onSubmit={onSubmit} className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="name-edit">Name</Label>
					<Input
						id="name-edit"
						value={name}
						onChange={(e) => setName(e.target.value)}
						autoFocus
						required
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label>Color</Label>
					<ColorPicker value={color} onChange={setColor} />
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
					<Button type="submit" disabled={submitting}>
						{submitting && <Loader2Icon className="h-4 w-4 animate-spin" />}
						Save
					</Button>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}

export function ColorPicker({
	value,
	onChange,
}: {
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			{PROJECT_COLORS.map((c) => (
				<button
					key={c.value}
					type="button"
					onClick={() => onChange(c.value)}
					className={cn(
						"h-7 w-7 rounded-full ring-offset-background transition-all",
						c.className,
						value === c.value
							? "ring-2 ring-ring ring-offset-2"
							: "hover:scale-110",
					)}
					aria-label={c.value}
				/>
			))}
		</div>
	);
}

export { PROJECT_COLORS };
