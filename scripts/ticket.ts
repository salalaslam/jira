#!/usr/bin/env tsx
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const PRODUCTION_CONVEX_URL = "https://helpful-ram-837.convex.cloud";
const SESSION_PATH = resolve(process.cwd(), ".ticket-session.local");

const statuses = ["todo", "in_progress", "done", "cancelled"] as const;
type TicketStatus = (typeof statuses)[number];

type SessionCache = Record<string, { token: string; username: string }>;

type Ticket = {
	title: string;
	status: TicketStatus;
	priority: string;
	cancelReason?: string;
	link?: string;
	description: string;
};

const statusAliases: Record<string, TicketStatus> = {
	todo: "todo",
	in_progress: "in_progress",
	done: "done",
	cancelled: "cancelled",
	close: "done",
	closed: "done",
	complete: "done",
	cancel: "cancelled",
	"in-progress": "in_progress",
	wip: "in_progress",
	start: "in_progress",
	reopen: "todo",
	open: "todo",
};

const help = `Usage: tsx scripts/ticket.ts <status|show> <ticket-url-or-todoId> [--reason "..."] [--dev]

Statuses: todo, in_progress, done, cancelled
Aliases: close, closed, complete → done; cancel → cancelled;
         in-progress, wip, start → in_progress; reopen, open → todo

Options:
  --reason "..."  Cancellation reason (only with cancelled)
  --dev           Use VITE_CONVEX_URL from .env.local instead of production
  --help          Show this help

Environment:
  TICKET_CONVEX_URL  Override the production Convex URL
  TICKET_USERNAME    Login username (default: salal)
  TICKET_PASSWORD    Login password (read from .env.local)`;

class CliError extends Error {
	constructor(message: string, readonly showHelp = false) {
		super(message);
	}
}

function loadEnv() {
	const envPath = resolve(process.cwd(), ".env.local");
	try {
		const raw = readFileSync(envPath, "utf8");
		for (const line of raw.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eq = trimmed.indexOf("=");
			if (eq === -1) continue;
			const key = trimmed.slice(0, eq).trim();
			let value = trimmed.slice(eq + 1).trim();
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			if (!process.env[key]) process.env[key] = value;
		}
	} catch {
		// No .env.local; rely on the process environment.
	}
}

function parseArgs(args: string[]) {
	if (args.includes("--help")) {
		console.log(help);
		process.exit(0);
	}

	const positional: string[] = [];
	let reason: string | undefined;
	let dev = false;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--reason") {
			if (reason !== undefined) {
				throw new CliError("--reason may only be provided once.", true);
			}
			const value = args[index + 1];
			if (value === undefined || value.startsWith("--")) {
				throw new CliError("--reason requires a value.", true);
			}
			reason = value;
			index += 1;
			continue;
		}
		if (arg === "--dev") {
			if (dev) throw new CliError("--dev may only be provided once.", true);
			dev = true;
			continue;
		}
		if (arg.startsWith("--")) {
			throw new CliError(`Unknown option: ${arg}`, true);
		}
		positional.push(arg);
	}

	if (positional.length !== 2) {
		throw new CliError("Provide a status (or show) and a ticket URL or ID.", true);
	}

	const command = positional[0]!;
	const ticketInput = positional[1]!;
	if (command === "show") {
		if (reason !== undefined) {
			throw new CliError(
				"--reason is only valid when changing a ticket to cancelled.",
				true,
			);
		}
		return { command: "show" as const, ticketInput, dev };
	}

	const status = statusAliases[command.toLowerCase()];
	if (!status) {
		throw new CliError(`Unknown status: ${command}`, true);
	}
	if (reason !== undefined && status !== "cancelled") {
		throw new CliError(
			"--reason is only valid when changing a ticket to cancelled.",
			true,
		);
	}

	return { command: "update" as const, ticketInput, status, reason, dev };
}

function resolveTodoId(input: string): Id<"todos"> {
	if (!input) throw new CliError("Provide a ticket URL or todo ID.", true);

	if (!input.includes("://")) return input as Id<"todos">;

	let url: URL;
	try {
		url = new URL(input);
	} catch {
		throw new CliError("Not a valid ticket ID or URL.", true);
	}

	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new CliError("Not a valid ticket ID or URL.", true);
	}
	const segments = url.pathname.split("/").filter(Boolean);
	if (segments.length !== 3 || segments[0] !== "projects") {
		throw new CliError("Not a valid ticket ID or URL.", true);
	}

	return segments[2] as Id<"todos">;
}

function resolveConvexUrl(dev: boolean) {
	const raw = dev
		? process.env.VITE_CONVEX_URL
		: process.env.TICKET_CONVEX_URL || PRODUCTION_CONVEX_URL;
	if (!raw) {
		throw new CliError(
			"VITE_CONVEX_URL is not set. Add it to .env.local before using --dev.",
		);
	}

	try {
		const url = new URL(raw);
		if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
	} catch {
		throw new CliError("The selected Convex URL must be a valid HTTP(S) URL.");
	}

	return raw.replace(/\/+$/, "");
}

function readSessionCache(): SessionCache {
	try {
		const raw = readFileSync(SESSION_PATH, "utf8");
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("not an object");
		}

		const cache: SessionCache = {};
		for (const [url, entry] of Object.entries(parsed)) {
			if (
				entry &&
				typeof entry === "object" &&
				"token" in entry &&
				"username" in entry &&
				typeof entry.token === "string" &&
				typeof entry.username === "string"
			) {
				cache[url] = { token: entry.token, username: entry.username };
			}
		}
		return cache;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
		throw new CliError(
			"Could not read .ticket-session.local. Delete or repair the file and try again.",
		);
	}
}

function writeSessionCache(cache: SessionCache) {
	writeFileSync(SESSION_PATH, `${JSON.stringify(cache, null, "\t")}\n`, {
		mode: 0o600,
	});
	chmodSync(SESSION_PATH, 0o600);
}

function convexSiteUrl(convexUrl: string) {
	return convexUrl.replace(/\.convex\.cloud$/, ".convex.site");
}

// Exchanges a Better Auth session cookie for a short-lived Convex JWT.
async function fetchConvexJwt(siteUrl: string, cookie: string) {
	const response = await fetch(`${siteUrl}/api/auth/convex/token`, {
		headers: { cookie },
	});
	if (!response.ok) return null;
	const body = (await response.json()) as { token?: string } | null;
	return body?.token ?? null;
}

async function signIn(siteUrl: string, username: string, password: string) {
	const response = await fetch(`${siteUrl}/api/auth/sign-in/username`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ username, password }),
	});
	const cookie = response.headers
		.getSetCookie()
		.map((header) => header.split(";")[0])
		.filter((pair) => pair.includes("session_token="))
		.join("; ");
	if (!response.ok || !cookie) {
		throw new CliError(
			"Login failed. Check TICKET_USERNAME and TICKET_PASSWORD, then try again.",
		);
	}
	return cookie;
}

async function authenticate(
	client: ConvexHttpClient,
	convexUrl: string,
	username: string,
) {
	const siteUrl = convexSiteUrl(convexUrl);
	const cache = readSessionCache();
	const cached = cache[convexUrl];
	const normalizedUsername = username.trim().toLowerCase();

	if (cached && cached.username === normalizedUsername) {
		const jwt = await fetchConvexJwt(siteUrl, cached.token).catch(() => {
			throw new CliError(
				"Unable to validate the cached session. Check your network and Convex URL.",
			);
		});
		if (jwt) {
			client.setAuth(jwt);
			return;
		}
	}

	const password = process.env.TICKET_PASSWORD;
	if (!password) {
		throw new CliError(
			"TICKET_PASSWORD is not set. Add TICKET_PASSWORD=... to .env.local and try again.",
		);
	}

	const cookie = await signIn(siteUrl, username, password);
	const jwt = await fetchConvexJwt(siteUrl, cookie);
	if (!jwt) throw new CliError("Signed in, but could not get a Convex token.");
	client.setAuth(jwt);
	cache[convexUrl] = { token: cookie, username: normalizedUsername };
	writeSessionCache(cache);
}

function isInvalidTodoIdError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	return (
		message.includes("ArgumentValidationError") ||
		(message.includes("todoId") && message.includes("validator"))
	);
}

async function getTicket(
	client: ConvexHttpClient,
	todoId: Id<"todos">,
): Promise<Ticket> {
	let ticket: Ticket | null;
	try {
		ticket = await client.query(api.todos.get, { todoId });
	} catch (error) {
		if (isInvalidTodoIdError(error)) {
			throw new CliError("Not a valid ticket ID or URL.");
		}
		throw error;
	}
	if (!ticket) throw new CliError("Ticket not found.");
	return ticket;
}

function printTicket(ticket: Ticket) {
	console.log(`Title: ${ticket.title}`);
	console.log(`Status: ${ticket.status}`);
	console.log(`Priority: ${ticket.priority}`);
	console.log(`Cancel reason: ${ticket.cancelReason ?? "(none)"}`);
	console.log(`Link: ${ticket.link ?? "(none)"}`);
	console.log(`Description: ${ticket.description || "(none)"}`);
}

async function main() {
	loadEnv();
	const options = parseArgs(process.argv.slice(2));
	const todoId = resolveTodoId(options.ticketInput);
	const convexUrl = resolveConvexUrl(options.dev);
	const username = process.env.TICKET_USERNAME || "salal";
	const client = new ConvexHttpClient(convexUrl);
	await authenticate(client, convexUrl, username);
	const ticket = await getTicket(client, todoId);

	if (options.command === "show") {
		printTicket(ticket);
		return;
	}

	if (ticket.status === options.status) {
		console.log(`Ticket "${ticket.title}" is already ${options.status}.`);
		return;
	}

	try {
		await client.mutation(api.todos.update, {
			todoId,
			status: options.status,
			...(options.reason !== undefined
				? { cancelReason: options.reason }
				: {}),
		});
	} catch (error) {
		if (isInvalidTodoIdError(error)) {
			throw new CliError("Not a valid ticket ID or URL.");
		}
		throw error;
	}

	const updatedTicket = await getTicket(client, todoId);
	console.log(
		`Updated "${updatedTicket.title}": ${ticket.status} → ${updatedTicket.status}.`,
	);
}

main().catch((error) => {
	if (error instanceof CliError) {
		console.error(`Error: ${error.message}`);
		if (error.showHelp) console.error(`\n${help}`);
	} else {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Ticket command failed: ${message}`);
	}
	process.exit(1);
});
