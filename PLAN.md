# football-chat plan

**Goal:** a chat app where you ask NFL questions and get answers based on real data, not the model's memory.

**Status (2026-10-17):** the app works end to end on a local machine. The chat answers from the database, shows which data it used, and handles ambiguous, unanswerable and off-topic questions. Remaining work: broader model testing, design polish, safeguards and hosting.

## Architecture

```
nflverse (online) → Python loader → SQLite file → Astro server (/api/chat) → LLM (with tools) → chat UI
```

- **Data:** free NFL stats from [nflverse](https://github.com/nflverse/nflverse-data) (CC-BY-4.0, so the app credits nflverse).
- **Approach:** tool use, not RAG. The model calls tools like `get_player_season_stats` or `run_sql`, our code queries the database, and the model writes the answer from the exact rows returned.
- **Database:** a single SQLite file (`data/nfl.db`, about 196 MB), gitignored.
- **UI and server:** Astro 7 with the Node adapter. The `/api/chat` route holds the API key and runs the queries.
- **Model:** Gemini (`gemini-3.8-flash`) through the Vercel AI SDK, so the provider can be swapped by changing `.env` and adding a case in `src/lib/model.ts`.

## Data loaded

Teams, players, schedules, rosters, weekly player stats and weekly team stats, 1999 to the current season. The loader downloads nflverse's Parquet files directly (the `nflreadpy` package needs Python 3.10+, and this machine has 3.9). Play-by-play is left out because it is very large.

## Build order

- [x] 1. **Loader:** `scripts/load_data.py` builds the SQLite database from nflverse files.
- [x] 2. **Astro project:** Astro with the Node adapter.
- [x] 3. **Model config:** `src/lib/model.ts` picks the provider and model from `.env`. Paid Gemini billing is enabled, so the free-tier 5 requests/minute cap no longer applies.
- [x] 4. **Tools:** `find_player`, `get_player_season_stats`, `get_player_game_log`, `get_games`, `get_standings`, `get_season_leaders` and a guarded read-only `run_sql`. 27 automated known-answer tests (`npm test`).
- [x] 5. **Chat route:** `/api/chat` streams the answer and tool use.
- [x] 6. **Chat page:** home page chat UI with example questions, markdown answers, "Data used" chips, dark mode and a mobile layout. The old data search page lives at `/data`.
- [ ] 7. **Model-level testing:** partly done. The tools are tested, but only about eight questions have been run through the model by hand. See "Next steps".

## Rules for the app

- [x] The system prompt tells the model to answer only from tool results, and to say it doesn't know if the data doesn't have it.
- [x] Each answer shows which data it came from.
- [x] The API key lives in `.env`, never in browser code.
- [x] `.env`, `data/` and the database file are gitignored.
- [ ] Rate limiting before the app is public (see Next steps).

## Next steps

Roughly in order of priority.

### 1. Model-level test set
- [ ] Write about 25 known-answer questions covering players, games, standings, leaders, ambiguous names, unanswerable questions and off-topic questions.
- [ ] Run them through the model automatically and record the pass rate.
- [ ] Use it to compare models (e.g. a cheaper Flash-Lite model vs. Flash, or Claude) and to catch regressions when prompts or tools change.

### 2. Design polish
- [ ] Refine the visual design (type, color, spacing, message styling). Tokens live in `:root` in `src/pages/index.astro`.
- [ ] Improve the loading state and the empty state.
- [ ] Add a way to start a new conversation.

### 3. Safeguards before going public
- [ ] Rate limiting per visitor on `/api/chat` (every question spends Google credit).
- [ ] Spending alert and budget cap in Google Cloud Billing.
- [ ] Review NFL data terms if the app becomes public or commercial.

### 4. Slim the database (helps every hosting option)
- [ ] Keep only the columns the tools and `run_sql` use (the weekly stats table has 150 columns; the tools use about 35).
- [ ] Decide whether to cut the oldest seasons.
- [ ] Re-run the tests to confirm answers are unchanged. Keep the full database behind a `--full` loader option.

### 5. Hosting
Options researched (free-tier details come from third-party comparison sites; re-check provider pricing pages before choosing):
- **Vercel with a slimmed, bundled read-only database.** Free, always on. Needs the Vercel adapter, a database under the 250 MB function limit, and a way to get the file into the deploy.
- **Render free web service.** Almost no code changes, but the app sleeps after 15 idle minutes and takes about a minute to wake.
- **Hosted database (Turso or Cloudflare D1).** Most flexible, but needs `db.ts` rewritten to be async. D1's free plan has daily read caps.
- Fly.io has no free tier for new accounts, and Railway's free credit looks short-lived.

### 6. Data refresh
- [ ] Re-run the loader on a schedule during the season (e.g. nightly or weekly). The database is currently a one-time snapshot, so in-season stats go stale.

### 7. Optional extras
- [ ] Play-by-play for recent seasons (third downs, red zone, drives). Large, so only if wanted.
- [ ] Injuries, depth charts and other nflverse datasets.
- [ ] Use `nflreadpy` in the loader if a Python 3.10+ is installed.

### 8. Housekeeping
- [ ] Add `.claude/` to `.gitignore` (the launch config holds a local path).
- [ ] Delete the merged feature branches on GitHub and locally.
- [ ] Remove the old Node 22.14.0 from nvm so nothing picks it up (Astro 7 needs 22.22 or newer).
- [ ] Add a `.nvmrc` for the required Node version.

## Open items

- Hosting choice (see Next steps, section 5).
- Whether the app stays a hobby project. Public or commercial use needs a closer look at NFL data terms and higher rate limits.
- Free-tier prompts are used by Google to improve products; the paid tier is not. Public NFL stats are fine either way.
