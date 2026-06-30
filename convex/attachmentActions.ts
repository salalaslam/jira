"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { createDownloadUrl, createUploadUrl } from "./storage";

type PreparedUpload = {
	objectKey: string;
	fileName: string;
	contentType: string;
	size: number;
};

export const generateUploadUrl = action({
	args: {
		token: v.string(),
		todoId: v.id("todos"),
		fileName: v.string(),
		contentType: v.string(),
		size: v.number(),
	},
	returns: v.object({
		uploadUrl: v.string(),
		objectKey: v.string(),
		fileName: v.string(),
		contentType: v.string(),
		size: v.number(),
	}),
	handler: async (ctx, { token, todoId, fileName, contentType, size }) => {
		await ctx.runQuery(internal.auth.requireUserForAction, { token });

		const prepared: PreparedUpload = await ctx.runMutation(
			internal.attachmentInternals.prepareUpload,
			{
				todoId,
				fileName,
				contentType,
				size,
			},
		);

		const uploadUrl = await createUploadUrl(
			prepared.objectKey,
			prepared.contentType,
			prepared.size,
		);

		return {
			uploadUrl,
			objectKey: prepared.objectKey,
			fileName: prepared.fileName,
			contentType: prepared.contentType,
			size: prepared.size,
		};
	},
});

export const getDownloadUrl = action({
	args: {
		token: v.string(),
		attachmentId: v.id("todoAttachments"),
	},
	returns: v.object({
		downloadUrl: v.string(),
		fileName: v.string(),
	}),
	handler: async (
		ctx,
		{ token, attachmentId },
	): Promise<{ downloadUrl: string; fileName: string }> => {
		await ctx.runQuery(internal.auth.requireUserForAction, { token });

		const attachment: {
			objectKey: string;
			fileName: string;
		} | null = await ctx.runQuery(
			internal.attachmentInternals.getForAction,
			{
				attachmentId,
			},
		);
		if (!attachment) throw new Error("Attachment not found");

		const downloadUrl = await createDownloadUrl(
			attachment.objectKey,
			attachment.fileName,
		);

		return { downloadUrl, fileName: attachment.fileName };
	},
});
