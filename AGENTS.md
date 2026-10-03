# Bubble It Customer Web

Next.js 16 App Router, React 19, TypeScript, npm/Nx. This repo owns marketing, bookings, memberships, store checkout, account, and legal pages.

## Read context for the task

AGENTS.md is canonical; CLAUDE.md only imports it. Read the matching guide below before editing, including when a domain crosses components, app routes, lib helpers, or tests. Shared UI and helper guides apply to callers too. Do not load every domain by default.

## Related repositories

These three repos form one product. The paths below are known local checkouts; worktrees and CI may use other locations.

| Repository | Owns | Known local checkout |
| --- | --- | --- |
| [bubbleit-backend](../../Bubbleit/bubbleit-backend/AGENTS.md) | Authoritative APIs, business rules, auth, payments, accounting, inventory, and dispatch | `~/Documents/Bubbleit/bubbleit-backend` |
| [bubbleit-mobile](../../Bubbleit/bubbleit-mobile/AGENTS.md) | Staff operations for iOS, Android, and Web; tutorial workspace at `apps/bubbleit-docs` | `~/Documents/Bubbleit/bubbleit-mobile` |
| [bubbleit-landing-page](AGENTS.md) | Customer website, booking, memberships, store, account, and customer BFF | `~/Documents/GitHub/bubbleit-landing-page` |

When a task crosses a repo boundary, read that repo's root AGENTS.md and relevant domain guide first. Use the active checkout/worktree for edits and modify only repos required by the user's task. If a listed path is missing, locate an existing checkout by repo name or ask; do not invent a replacement or infer deployment URLs from filesystem paths. Backend contracts remain authoritative, with coordinated schema and duration copies in both clients.

## Global safeguards

- Browser traffic uses the same origin customer BFF. Backend bearer tokens stay in its HttpOnly cookie, never localStorage, script readable cookies, or browser authorization headers.
- Backend contracts own availability, duration, price, coverage, stock, and payment/refund state. Customer screens never expose internal accounting or dispatch data; a browser provider return does not prove payment.
- Preserve English/Arabic, RTL, server lang/dir, responsive accessibility, and authored content. Use shared controls/catalog/helpers and the coordinated schema/duration snapshots.
- Tests use isolated loopback services, not live providers or shared data. No production mock fallback or new general polling.
- Preserve existing work and scope. Commits, pushes, merges, and deployments require a user request. Update the primary domain AGENTS guide and CHANGELOG for durable changes; surface code/contract conflicts rather than guessing.

## Commands

From this root use `npm exec nx -- run bubbleit-landing-page:<target>` with declared targets `lint`, `test`, `test:session`, `test:e2e`, `test:security`, or `build`. Before release, run relevant focused checks plus these gates. Builds require a configured backend base; Playwright uses isolated loopback configuration in `playwright.config.ts`, not a production smoke test.

## Context files

- [app/AGENTS.md](app/AGENTS.md) (The customer BFF, session cookies, authentication, account pages, and security policy)
- [components/AGENTS.md](components/AGENTS.md) (Navigation, shared controls, feedback, responsive layout, and accessibility)
- [components/booking/AGENTS.md](components/booking/AGENTS.md) (The adaptive booking wizard, owner membership choices, optional products, and loyalty)
- [components/store/AGENTS.md](components/store/AGENTS.md) (Product catalog, cart, authenticated checkout, and pending order recovery)
- [lib/AGENTS.md](lib/AGENTS.md) (API types, duration, service eligibility, localization, Qatar time, and safe development mocks)

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
