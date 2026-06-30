import { useAction, useMutation, useQuery } from "convex/react";
import {
	DownloadIcon,
	FileIcon,
	Loader2Icon,
	PaperclipIcon,
	Trash2Icon,
	UploadIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { useSession } from "#/lib/session";
import { cn, formatFileSize } from "#/lib/utils";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Attachment = {
	_id: Id<"todoAttachments">;
	_creationTime: number;
	todoId: Id<"todos">;
	fileName: string;
	contentType: string;
	size: number;
	objectKey: string;
	uploadedBy: Id<"users">;
};

export function TodoAttachments({
	todoId,
	compact = false,
	className,
}: {
	todoId: Id<"todos">;
	compact?: boolean;
	className?: string;
}) {
	const { token } = useSession();
	const attachments = useQuery(
		api.attachments.listForTodo,
		token ? { token, todoId } : "skip",
	);
	const generateUploadUrl = useAction(api.attachmentActions.generateUploadUrl);
	const getDownloadUrl = useAction(api.attachmentActions.getDownloadUrl);
	const addAttachment = useMutation(api.attachments.add);
	const removeAttachment = useMutation(api.attachments.remove);

	const inputRef = React.useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = React.useState(false);
	const [removingId, setRemovingId] =
		React.useState<Id<"todoAttachments"> | null>(null);
	const [downloadingId, setDownloadingId] =
		React.useState<Id<"todoAttachments"> | null>(null);

	async function uploadFiles(files: FileList | File[]) {
		if (!token) return;
		const list = Array.from(files);
		if (list.length === 0) return;

		setUploading(true);
		try {
			for (const file of list) {
				const prepared = await generateUploadUrl({
					token,
					todoId,
					fileName: file.name,
					contentType: file.type || "application/octet-stream",
					size: file.size,
				});

				const response = await fetch(prepared.uploadUrl, {
					method: "PUT",
					body: file,
					headers: {
						"Content-Type": prepared.contentType,
					},
				});

				if (!response.ok) {
					throw new Error(`Upload failed for ${file.name}`);
				}

				await addAttachment({
					token,
					todoId,
					fileName: prepared.fileName,
					contentType: prepared.contentType,
					size: prepared.size,
					objectKey: prepared.objectKey,
				});
			}
			toast.success(
				list.length === 1 ? "File uploaded" : `${list.length} files uploaded`,
			);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Upload failed");
		} finally {
			setUploading(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	async function downloadAttachment(attachment: Attachment) {
		if (!token) return;
		setDownloadingId(attachment._id);
		try {
			const { downloadUrl } = await getDownloadUrl({
				token,
				attachmentId: attachment._id,
			});
			window.open(downloadUrl, "_blank", "noopener,noreferrer");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Download failed");
		} finally {
			setDownloadingId(null);
		}
	}

	async function deleteAttachment(attachmentId: Id<"todoAttachments">) {
		if (!token) return;
		setRemovingId(attachmentId);
		try {
			await removeAttachment({ token, attachmentId });
			toast.success("Attachment removed");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to remove");
		} finally {
			setRemovingId(null);
		}
	}

	if (compact) {
		if (attachments === undefined) return null;
		if (attachments.length === 0) return null;
		return (
			<div className={cn("mt-1 flex flex-wrap gap-1.5", className)}>
				{attachments.map((attachment) => (
					<button
						key={attachment._id}
						type="button"
						onClick={() => void downloadAttachment(attachment)}
						disabled={downloadingId === attachment._id}
						className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
						title={attachment.fileName}
					>
						{downloadingId === attachment._id ? (
							<Loader2Icon className="h-3 w-3 animate-spin shrink-0" />
						) : (
							<PaperclipIcon className="h-3 w-3 shrink-0" />
						)}
						<span className="truncate">{attachment.fileName}</span>
					</button>
				))}
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<div className="flex items-center justify-between gap-2">
				<Label>Attachments</Label>
				<div>
					<Input
						ref={inputRef}
						type="file"
						multiple
						className="hidden"
						onChange={(e) => {
							if (e.target.files) void uploadFiles(e.target.files);
						}}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={uploading}
						onClick={() => inputRef.current?.click()}
					>
						{uploading ? (
							<Loader2Icon className="h-4 w-4 animate-spin" />
						) : (
							<UploadIcon className="h-4 w-4" />
						)}
						Upload files
					</Button>
				</div>
			</div>
			<p className="text-xs text-muted-foreground">Up to 20 MB per file.</p>
			{attachments === undefined ? (
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<Loader2Icon className="h-3.5 w-3.5 animate-spin" />
					Loading attachments…
				</div>
			) : attachments.length === 0 ? (
				<p className="text-xs text-muted-foreground">No files attached yet.</p>
			) : (
				<ul className="flex flex-col gap-1.5">
					{attachments.map((attachment) => (
						<li
							key={attachment._id}
							className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5"
						>
							<FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm">{attachment.fileName}</div>
								<div className="text-[11px] text-muted-foreground">
									{formatFileSize(attachment.size)}
								</div>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								title="Download"
								disabled={downloadingId === attachment._id}
								onClick={() => void downloadAttachment(attachment)}
							>
								{downloadingId === attachment._id ? (
									<Loader2Icon className="h-4 w-4 animate-spin" />
								) : (
									<DownloadIcon className="h-4 w-4" />
								)}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-destructive hover:text-destructive"
								title="Remove"
								disabled={removingId === attachment._id}
								onClick={() => void deleteAttachment(attachment._id)}
							>
								{removingId === attachment._id ? (
									<Loader2Icon className="h-4 w-4 animate-spin" />
								) : (
									<Trash2Icon className="h-4 w-4" />
								)}
							</Button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export async function uploadFilesToTodo({
	token,
	todoId,
	files,
	generateUploadUrl,
	addAttachment,
}: {
	token: string;
	todoId: Id<"todos">;
	files: File[];
	generateUploadUrl: (args: {
		token: string;
		todoId: Id<"todos">;
		fileName: string;
		contentType: string;
		size: number;
	}) => Promise<{
		uploadUrl: string;
		objectKey: string;
		fileName: string;
		contentType: string;
		size: number;
	}>;
	addAttachment: (args: {
		token: string;
		todoId: Id<"todos">;
		fileName: string;
		contentType: string;
		size: number;
		objectKey: string;
	}) => Promise<Id<"todoAttachments">>;
}) {
	for (const file of files) {
		const prepared = await generateUploadUrl({
			token,
			todoId,
			fileName: file.name,
			contentType: file.type || "application/octet-stream",
			size: file.size,
		});

		const response = await fetch(prepared.uploadUrl, {
			method: "PUT",
			body: file,
			headers: {
				"Content-Type": prepared.contentType,
			},
		});

		if (!response.ok) {
			throw new Error(`Upload failed for ${file.name}`);
		}

		await addAttachment({
			token,
			todoId,
			fileName: prepared.fileName,
			contentType: prepared.contentType,
			size: prepared.size,
			objectKey: prepared.objectKey,
		});
	}
}
