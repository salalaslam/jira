export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function sanitizeFileName(fileName: string) {
	const base = fileName.split(/[/\\]/).pop()?.trim() ?? "file";
	const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 120);
	return cleaned || "file";
}

export function buildObjectKey(todoId: string, fileName: string) {
	const safeName = sanitizeFileName(fileName);
	const unique = crypto.randomUUID();
	return `todos/${todoId}/${unique}-${safeName}`;
}

export function assertObjectKeyForTodo(objectKey: string, todoId: string) {
	const prefix = `todos/${todoId}/`;
	if (!objectKey.startsWith(prefix)) {
		throw new Error("Invalid attachment object key");
	}
}

export function assertFileSize(size: number) {
	if (!Number.isFinite(size) || size <= 0) {
		throw new Error("File size must be greater than zero");
	}
	if (size > MAX_FILE_BYTES) {
		throw new Error(`File exceeds ${MAX_FILE_BYTES / (1024 * 1024)}MB limit`);
	}
}

export function formatFileSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
