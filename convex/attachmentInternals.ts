import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import {
	assertFileSize,
	buildObjectKey,
	sanitizeFileName,
} from "./storageHelpers";

export const getForAction = internalQuery({
	args: { attachmentId: v.id("todoAttachments") },
	handler: async (ctx, { attachmentId }) => {
		return await ctx.db.get(attachmentId);
	},
});

export const prepareUpload = internalMutation({
	args: {
		todoId: v.id("todos"),
		fileName: v.string(),
		contentType: v.string(),
		size: v.number(),
	},
	handler: async (ctx, { todoId, fileName, contentType, size }) => {
		const todo = await ctx.db.get(todoId);
		if (!todo) throw new Error("Todo not found");

		assertFileSize(size);
		const objectKey = buildObjectKey(todoId, fileName);

		return {
			objectKey,
			fileName: sanitizeFileName(fileName),
			contentType: contentType || "application/octet-stream",
			size,
		};
	},
});
