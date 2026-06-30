"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { deleteObject } from "./storage";

export const deleteFromStorage = internalAction({
	args: { objectKey: v.string() },
	handler: async (_ctx, { objectKey }) => {
		await deleteObject(objectKey);
	},
});
