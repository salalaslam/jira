#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

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
		// no .env.local, rely on environment
	}
}

async function main() {
	loadEnv();
	const url = process.env.VITE_CONVEX_URL ?? process.env.CONVEX_URL;
	if (!url) {
		console.error("VITE_CONVEX_URL is not set. Run `npx convex dev` first.");
		process.exit(1);
	}

	const alicePassword = process.env.ALICE_PASSWORD;
	const bobPassword = process.env.BOB_PASSWORD;

	if (!alicePassword || !bobPassword) {
		console.error(
			"Set ALICE_PASSWORD and BOB_PASSWORD in .env.local before seeding.",
		);
		process.exit(1);
	}

	const client = new ConvexHttpClient(url);
	const results = await client.mutation(api.auth.seedUsers, {
		users: [
			{
				username: "alice",
				displayName: "Alice",
				password: alicePassword,
			},
			{
				username: "bob",
				displayName: "Bob",
				password: bobPassword,
			},
		],
	});

	console.log("Seed complete:");
	for (const r of results) {
		console.log(`  ${r.username}: ${r.status}`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
