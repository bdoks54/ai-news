# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Korean-language AI news reader: pulls TechCrunch and The Verge AI RSS feeds, has Claude translate, summarize, and categorize each article into the user's categories, shows the results as cards, and saves chosen articles to Notion through the Notion remote MCP server. `PRD.md` holds the full requirements and acceptance criteria. User-facing strings, code comments, and docs are written in Korean; keep it that way.

## Commands

```bash
npm run dev          # next dev (Turbopack)
npm run build        # production build; also the main type-check
npm run lint         # eslint (flat config, next core-web-vitals + typescript)
npm run db:push      # sync src/db/schema.ts to Neon (the setup flow in this repo; no drizzle/ migrations dir yet)
npm run db:generate  # / db:migrate / db:studio — drizzle-kit
```

There is no test suite. drizzle-kit reads `DATABASE_URL` from `.env.local` (see `drizzle.config.ts`). Required env vars are listed in `.env.example`; `TOKEN_ENCRYPTION_KEY` must be 32 bytes, base64-encoded.

## Next.js 16 specifics (check `node_modules/next/dist/docs/` before writing code)

- Auth gating lives in `src/proxy.ts` (Next 16 renamed `middleware` to `proxy`). It runs Clerk `auth.protect()` on everything except `/sign-in` and `/sign-up`. Every route handler and server action still calls `auth()` itself and scopes every query by `userId`. Per-user isolation is a hard requirement.
- `next.config.ts` enables `cacheComponents` and `partialPrefetching`, and Tailwind v4 runs through a Turbopack CSS loader rule (`@tailwindcss/turbopack`), not PostCSS.
- Pages use the global `PageProps<"/route">` type and `await searchParams`.

## Architecture

**Data (`src/db/`)**: Drizzle over `@neondatabase/serverless` (HTTP driver). There are three tables:
- `categories`, unique on (userId, name).
- `articles`, unique on (userId, originalUrl). `categoryId` is nullable, and null means **미분류** (uncategorized). Deleting a category sets `categoryId` to null through the FK's `onDelete: "set null"`, with no app code involved.
- `notion_connections`, keyed by userId. Tokens are AES-256-GCM encrypted by `src/lib/crypto.ts`. The schema stores `parentPageUrl`; the PRD's `parentPageId` is stale.

**Categories (`src/lib/categories.ts`)**: `getOrCreateCategories` seeds the six default categories the first time a user loads a page. Claude returns category *names*, and `resolveCategoryId` maps them back to ids by case-insensitive match. Anything that doesn't match, including the literal `"미분류"` (`UNCATEGORIZED`), becomes null.

**Claude (`src/lib/claude.ts`, server-only)**: all LLM calls go through here.
- `summarizeArticles` and `classifyArticles` use `client.beta.messages.parse` with Zod structured output (`betaZodOutputFormat`) and `effort: "low"`. Articles go in as indexed `<article index="i">` blocks, and results are matched back by `index`, so a missing item becomes `null` instead of shifting the order.
- `saveArticleToNotion` uses the MCP connector beta (`mcp_servers` + `mcp_toolset`) against `https://mcp.notion.com/mcp`, passing the user's OAuth access token. The page URL is scraped by regex from the final text, then from `mcp_tool_result` blocks.
- Every call sets the server-side fallback beta (`fallbacks: "default"`). The model is `CLAUDE_MODEL`, defaulting to `claude-sonnet-5-5`.

**News fetch (`src/app/api/news/fetch/route.ts`)**: `fetchAllFeeds` (rss.ts) uses `Promise.allSettled`, so a failed feed is reported but doesn't block the others. Already stored URLs are filtered out. New items go to Claude in batches of 10 with 3 batches in flight; inserts use `onConflictDoNothing`, and the route has `maxDuration = 300`. `/api/news/reclassify` follows the same batching pattern with `classifyArticles`.

**Notion OAuth (`src/lib/notion-oauth.ts`)**: Notion's MCP server acts as its own OAuth authorization server. `/api/notion/oauth/start` does dynamic client registration (RFC 7591, public client, no secret) plus PKCE and keeps the verifier/state in the `notion_oauth` cookie. The callback exchanges the code and stores the encrypted tokens along with the `clientId`, which is needed for refresh. `getValidAccessToken` refreshes when the token expires within 60s. The redirect URI is built from `APP_URL`, so it has to match the running origin.

**UI**: Server components under `src/app/` query the DB directly. Mutations go through server actions (`categories/actions.ts`, `settings/actions.ts`) with `revalidatePath`, or client components in `src/components/` that POST to the API routes. The home page filters with `?category=<id|uncategorized>`.
