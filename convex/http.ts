import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { type ActionCtx, httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

// --- MCP server (Streamable HTTP, stateless, JSON responses) ---------------
// Reached through the web app's /api/mcp proxy so clients see one origin.

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const statusEnum = ["todo", "in_progress", "done", "cancelled"];
const priorityEnum = ["low", "medium", "high"];

const tools = [
	{
		name: "list_projects",
		title: "List projects",
		description:
			"List active projects with ticket counts by status. Start here to find project names.",
		inputSchema: { type: "object", properties: {} },
		annotations: { readOnlyHint: true },
	},
	{
		name: "list_tickets",
		title: "List tickets",
		description:
			"List or search tickets (a.k.a. todos/tasks). Omit `project` to search every active project. Results are sorted by priority, newest first.",
		inputSchema: {
			type: "object",
			properties: {
				project: { type: "string", description: "Project name or id" },
				statuses: {
					type: "array",
					items: { type: "string", enum: statusEnum },
					description: "Only these statuses, e.g. [\"todo\", \"in_progress\"] for open work",
				},
				priority: { type: "string", enum: priorityEnum },
				search: { type: "string", description: "Text to match in title or description" },
				limit: { type: "number", description: "Max results (default 50, max 200)" },
			},
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "get_ticket",
		title: "Get ticket",
		description: "Full details of one ticket, including description, attachments and recent activity.",
		inputSchema: {
			type: "object",
			properties: {
				ticket: { type: "string", description: "Ticket id or its web URL" },
			},
			required: ["ticket"],
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "create_ticket",
		title: "Create ticket",
		description: "Create a ticket in a project. Returns the new ticket with its web URL.",
		inputSchema: {
			type: "object",
			properties: {
				project: { type: "string", description: "Project name or id" },
				title: { type: "string" },
				description: { type: "string", description: "Markdown is fine" },
				priority: { type: "string", enum: priorityEnum, description: "Default: medium" },
				status: { type: "string", enum: statusEnum, description: "Default: todo" },
				link: { type: "string", description: "Related URL (spec, design, etc.)" },
			},
			required: ["project", "title"],
		},
		annotations: { readOnlyHint: false, destructiveHint: false },
	},
	{
		name: "update_ticket",
		title: "Update ticket",
		description:
			"Change a ticket's title, description, status, priority or link. Only the fields you pass change. `description` replaces the whole description.",
		inputSchema: {
			type: "object",
			properties: {
				ticket: { type: "string", description: "Ticket id or its web URL" },
				title: { type: "string" },
				description: { type: "string" },
				status: { type: "string", enum: statusEnum },
				priority: { type: "string", enum: priorityEnum },
				link: { type: "string", description: "Empty string removes the link" },
				cancelReason: {
					type: "string",
					description: "Why it was cancelled (only with status cancelled)",
				},
			},
			required: ["ticket"],
		},
		annotations: { readOnlyHint: false, destructiveHint: false },
	},
];

type Args = Record<string, unknown>;

function pick(args: Args, keys: string[]) {
	const out: Args = {};
	for (const key of keys) {
		if (args[key] !== undefined && args[key] !== null) out[key] = args[key];
	}
	return out;
}

async function callTool(ctx: ActionCtx, authUserId: string, name: string, args: Args) {
	switch (name) {
		case "list_projects":
			return await ctx.runQuery(internal.mcpTools.listProjects, { authUserId });
		case "list_tickets":
			return await ctx.runQuery(internal.mcpTools.listTickets, {
				authUserId,
				...pick(args, ["project", "statuses", "priority", "search", "limit"]),
			});
		case "get_ticket":
			return await ctx.runQuery(internal.mcpTools.getTicket, {
				authUserId,
				ticket: String(args.ticket ?? ""),
			});
		case "create_ticket":
			return await ctx.runMutation(internal.mcpTools.createTicket, {
				authUserId,
				project: String(args.project ?? ""),
				title: String(args.title ?? ""),
				...pick(args, ["description", "priority", "status", "link"]),
			});
		case "update_ticket":
			return await ctx.runMutation(internal.mcpTools.updateTicket, {
				authUserId,
				ticket: String(args.ticket ?? ""),
				...pick(args, ["title", "description", "status", "priority", "link", "cancelReason"]),
			});
		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}

type JsonRpcRequest = {
	jsonrpc: "2.0";
	id?: string | number | null;
	method: string;
	params?: Record<string, unknown>;
};

function errorMessage(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	// Convex prefixes server errors with request metadata; keep the useful part.
	const match = message.match(/Uncaught Error: (.*?)(\n|$)/);
	if (match) return match[1];
	if (message.includes("ArgumentValidationError")) {
		return "Invalid arguments. Check the tool's input schema.";
	}
	return message;
}

async function handleMessage(
	ctx: ActionCtx,
	authUserId: string,
	message: JsonRpcRequest,
) {
	const { id, method, params } = message;
	const result = (value: unknown) => ({ jsonrpc: "2.0", id, result: value });
	const error = (code: number, text: string) => ({
		jsonrpc: "2.0",
		id,
		error: { code, message: text },
	});

	switch (method) {
		case "initialize": {
			const requested = String(params?.protocolVersion ?? "");
			return result({
				protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
					? requested
					: SUPPORTED_PROTOCOL_VERSIONS[0],
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: "tasks", title: "Tasks", version: "1.0.0" },
				instructions:
					"Project/ticket tracker. Use list_projects to discover projects, list_tickets to find work, get_ticket for details, then create_ticket or update_ticket. Always share the ticket url with the user after creating or changing a ticket.",
			});
		}
		case "ping":
			return result({});
		case "tools/list":
			return result({ tools });
		case "tools/call": {
			const name = String(params?.name ?? "");
			const args = (params?.arguments ?? {}) as Args;
			try {
				const data = await callTool(ctx, authUserId, name, args);
				return result({
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
					structuredContent: Array.isArray(data) ? { items: data } : data,
				});
			} catch (e) {
				return result({
					content: [{ type: "text", text: errorMessage(e) }],
					isError: true,
				});
			}
		}
		default:
			return error(-32601, `Method not found: ${method}`);
	}
}

const mcpHandler = httpAction(async (ctx, request) => {
	const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", {
			status: 405,
			headers: { Allow: "POST" },
		});
	}

	const auth = createAuth(ctx);
	const session = await auth.api.getMcpSession({ headers: request.headers });
	if (!session?.userId) {
		const challenge = `Bearer resource_metadata="${siteUrl}/.well-known/oauth-protected-resource/api/mcp"`;
		return Response.json(
			{
				jsonrpc: "2.0",
				id: null,
				error: { code: -32001, message: "Unauthorized" },
			},
			{
				status: 401,
				headers: {
					"WWW-Authenticate": challenge,
					"Access-Control-Expose-Headers": "WWW-Authenticate",
				},
			},
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json(
			{ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
			{ status: 400 },
		);
	}

	const messages = (Array.isArray(body) ? body : [body]) as JsonRpcRequest[];
	const responses = [];
	for (const message of messages) {
		// Notifications (no id) get no response.
		if (message?.id === undefined || message.id === null) continue;
		responses.push(await handleMessage(ctx, session.userId, message));
	}
	if (responses.length === 0) return new Response(null, { status: 202 });
	return Response.json(Array.isArray(body) ? responses : responses[0]);
});

for (const method of ["GET", "POST", "DELETE"] as const) {
	http.route({ path: "/api/mcp", method, handler: mcpHandler });
}

export default http;
