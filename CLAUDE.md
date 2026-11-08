# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
@ui.md

## Project

Korean-language AI news reader: pulls TechCrunch and The Verge AI RSS feeds, has Claude translate, summarize, and categorize each article into the user's categories, shows the results as cards, and saves chosen articles to Notion through the Notion REST API with a single internal integration token. `PRD.md` holds the full requirements and acceptance criteria. User-facing strings, code comments, and docs are written in Korean; keep it that way.

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
- `saveArticleToNotion` (MCP connector beta + per-user OAuth token) is no longer called by any route; Notion saving moved to `src/lib/notion.ts`.
- Every call sets the server-side fallback beta (`fallbacks: "default"`). The model is `CLAUDE_MODEL`, defaulting to `claude-sonnet-5-5`.

**News pipeline (two steps; `FetchButton` calls them in order)**:
1. **Collect (`src/app/api/news/fetch/route.ts`)**: `fetchAllFeeds({ since })` (rss.ts) keeps only items published in the last 24h and uses `Promise.allSettled`, so a failed feed is reported but doesn't block the others. Items are stored raw (`originalTitle`, `snippet`) with `titleKo`/`summaryKo`/`categoryId` null; `onConflictDoNothing` on (userId, originalUrl) skips known URLs. No Claude call here, `maxDuration = 60`.
2. **Process (`src/app/api/news/process/route.ts` → `processPendingArticles` in `src/lib/process.ts`)**: "pending" means `titleKo IS NULL`, with no status column. It takes up to 30 pending articles (newest first) and sends them to `summarizeArticles` in batches of 10 with 3 batches in flight. A single call returns the Korean title, Korean summary, and category name. Each row is updated, scoped by `id` **and** `userId`. Failed articles stay null and are retried on the next run. It returns `{ processed, failed, remaining }`, and the route has `maxDuration = 300`.

Until an article is processed, the UI falls back to `originalTitle`/`snippet`. `/api/news/reclassify` re-runs only categorization with `classifyArticles` (sequential batches of 25), using `coalesce(titleKo, originalTitle)` / `coalesce(summaryKo, snippet)` so unprocessed articles can be classified too.

**Notion save (`src/lib/notion.ts`)**: `/api/notion/save` calls the Notion REST API (`POST /v1/pages`, `Notion-Version: 2022-06-28`) directly with `NOTION_API_TOKEN`, an internal integration token shared by every user, and adds a row to the database `NOTION_DATABASE_ID` (id or URL; `parseNotionId` strips `?v=`). That database has to be shared with the integration (⋯ → 연결). Property names are hardcoded in `PROP`: 제목 (title), 요약 (rich_text), 날짜 (date), 출처 (url, the original link), 카테고리 (select; Notion creates missing options itself). The page body holds the source label, the original title, a bookmark, and the summary. `NotionError.needsSetup` maps to 409 + `needsConnect`, and the card then links to `/settings`, which only shows the status from `checkNotionStatus`. The saved URL goes into `articles.notionPageUrl`, scoped by userId.

**Notion OAuth (`src/lib/notion-oauth.ts`, currently unused)**: Notion's MCP server acts as its own OAuth authorization server. `/api/notion/oauth/start` does dynamic client registration (RFC 7591, public client, no secret) plus PKCE and keeps the verifier/state in the `notion_oauth` cookie. The callback exchanges the code and stores the encrypted tokens along with the `clientId`, which is needed for refresh. `getValidAccessToken` refreshes when the token expires within 60s. The redirect URI is built from `APP_URL`, so it has to match the running origin.

**UI**: Follow `ui.md` (colors, typography, layout, component class patterns) when adding or changing any screen. Server components under `src/app/` query the DB directly. Mutations go through server actions (`categories/actions.ts`, `settings/actions.ts`) with `revalidatePath`, or client components in `src/components/` that POST to the API routes. The main screen is `/dashboard` (`/` redirects there via `next.config.ts`) and filters with `?category=<id|uncategorized>`.
