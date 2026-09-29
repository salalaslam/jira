# Use tasks from Claude

You can ask Claude to look up, create, and update tickets for you, for example
"what's still open in Launch Week?" or "file a high-priority ticket for the
broken checkout link". Claude acts as you, so changes show up in the activity
feed under your name.

## What you need

- A tasks account (username + password). Ask an admin if you don't have one.
- Claude on the web, desktop, or mobile, with a plan that allows custom
  connectors.
- The app's address, e.g. `https://<your-app>.vercel.app`. The connector URL
  is that address followed by `/api/mcp`.

## Connect (one time, about a minute)

1. In Claude, open **Settings → Connectors**.
2. Click **Add custom connector**.
3. Name it `Tasks`, and paste the connector URL
   (`https://<your-app>.vercel.app/api/mcp`). Leave the advanced settings
   empty.
4. Click **Add**, then **Connect**. A tasks sign-in page opens.
5. Sign in with your tasks username and password. You're sent back to Claude
   and the connector shows as connected.

On Team or Enterprise plans an owner may need to add the connector first; after
that you only do step 4 and 5.

## Use it

In a chat, make sure **Tasks** is turned on in the tools menu, then just ask:

- "List my projects."
- "Show open high-priority tickets across all projects."
- "What's the latest on the electrician ticket?"
- "Create a ticket in Flat Refresh: 'Order paint samples', low priority."
- "Mark that ticket done." / "Cancel it, reason: duplicate."

Claude may ask your permission before creating or changing a ticket, and replies with a link to
the ticket in the app.

What it can do: list projects, list/search tickets, read a ticket (with its
activity), create tickets, and change a ticket's title, description, status,
priority, or link. What it can't do: delete or archive anything, change
projects, or edit locked projects.

## Troubleshooting

- **Sign-in page says the password is wrong:** use the same credentials as the
  tasks website. Ask an admin to reset your password if needed.
- **Claude says the connector needs to reconnect:** open Settings → Connectors
  and click **Connect** again. This happens after a password reset.
- **"Project is locked":** that project is read-only for everyone.
