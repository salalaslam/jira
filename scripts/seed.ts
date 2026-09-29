#!/usr/bin/env tsx
// Creates the demo accounts on the Convex deployment in .env.local.
// Accounts are provisioned through an internal action, so this needs the
// Convex CLI to be logged in to the project (`npx convex dev`).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
	try {
		const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
		for (const line of raw.split("\n")) {
			const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
			if (!match || process.env[match[1]]) continue;
			process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
		}
	} catch {
		// No .env.local; rely on the process environment.
	}
}

loadEnv();

const users = [
	{ username: "alice", displayName: "Alice", password: process.env.ALICE_PASSWORD },
	{ username: "bob", displayName: "Bob", password: process.env.BOB_PASSWORD },
];

if (users.some((user) => !user.password)) {
	console.error("Set ALICE_PASSWORD and BOB_PASSWORD in .env.local before seeding.");
	process.exit(1);
}

for (const user of users) {
	try {
		execFileSync("npx", ["convex", "run", "users:create", JSON.stringify(user)], {
			stdio: ["ignore", "ignore", "pipe"],
		});
		console.log(`  ${user.username}: created`);
	} catch (error) {
		const stderr = String((error as { stderr?: Buffer }).stderr ?? "");
		if (!stderr.includes("User already exists")) throw error;
		execFileSync(
			"npx",
			["convex", "run", "users:setPassword", JSON.stringify({ username: user.username, password: user.password })],
			{ stdio: ["ignore", "ignore", "inherit"] },
		);
		console.log(`  ${user.username}: password updated`);
	}
}
