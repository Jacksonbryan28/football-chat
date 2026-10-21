# football-chat

A chat app for asking questions about NFL stats and getting answers grounded in real data, not the model's memory.

> **Status:** early development. The data pipeline, a data-check page, the model connection, the database tools and the chat all work. The chat itself is not built yet. See [PLAN.md](PLAN.md) for the roadmap.

## How it works

```
nflverse (online) → Python loader → SQLite file → Astro server (/api/chat) → LLM (with tools) → chat UI
```

1. **Data.** Free NFL stats from [nflverse](https://github.com/nflverse/nflverse-data).
2. **Loader.** `scripts/load_data.py` downloads the files and builds a local SQLite database (`data/nfl.db`).
3. **Server.** An Astro app (Node adapter, with React, Tailwind and shadcn/ui for the interface) will expose a chat route that gives a language model tools for querying the database. The model writes answers from the rows those tools return, so stats come from the data rather than from memory.
4. **Model.** Gemini's free tier to start, behind a provider abstraction so it can be swapped for Claude, a local model, or another provider.

## What works today

- **Data loader:** builds a ~200 MB database with six tables covering 1999 to the current season:

  | Table | Contents |
  |---|---|
  | `teams` | Team names, divisions, colors, logos |
  | `players` | Player info and ID mappings |
  | `games` | Schedules and final scores |
  | `rosters` | Team rosters by season |
  | `player_week_stats` | Weekly player stats (passing, rushing, receiving, defense, and more) |
  | `team_week_stats` | Weekly team stats |

- **Chat** (the home page): ask NFL questions in plain English. The model looks up every number with the database tools, shows which data it used, and says so when the data can't answer.

- **Data check page** (`/data`): shows row counts for each table and lets you search a player's regular-season totals or a team's games, to confirm the data looks right.

## Getting started

### Requirements

- **Node.js 22.22 or newer** (Astro 7 requires it). If you use nvm: `nvm install 22`.
- **Python 3.9 or newer** for the loader.

### 1. Build the database

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/load_data.py
```

This takes about a minute and writes `data/nfl.db` plus a cache of downloaded files in `data/raw/`. To load fewer seasons, add `--start 2015`.

### 2. Add your API key

Copy the example file and put in a free Gemini key from [Google AI Studio](https://aistudio.google.com):

```bash
cp .env.example .env
```

Then edit `.env` and replace `paste-your-key-here`. The file is gitignored. Free-tier prompts may be used by Google to improve their products, so don't send private data.

### 3. Run the app

```bash
npm install
npm run dev
```

Then open http://localhost:4321 and ask a question, e.g. "Who led the NFL in rushing yards in 2023?". The data check page at http://localhost:4321/data lets you search the raw tables (teams use abbreviations like `KC`, `SF`, `BUF`).

## Tests

```bash
npm test
```

Checks the database tools against real results (e.g. Mahomes' 2023 totals, the Super Bowl LVIII score, 2023 league leaders). Requires `data/nfl.db`.

## Project layout

```
scripts/load_data.py    Downloads nflverse data and builds the SQLite database
src/lib/db.ts           Read-only database helper
src/lib/model.ts        Picks the AI provider and model from .env (swappable)
src/lib/queries.ts      Query functions behind the tools
src/lib/tools.ts        Tools the chat model can call (find_player, get_player_season_stats, ...)
src/lib/schema.ts       Plain-English description of the database for the model
src/lib/tools.test.ts   Known-answer tests (real NFL results vs. the database)
src/lib/teamColors.ts   Team colors, generated from the database by scripts/generate_team_colors.py
src/lib/teamHints.ts    Works out which team(s) a lookup is about (for the loading helmet)
src/pages/index.astro   Chat page shell (renders the React chat)
src/components/Chat.tsx The chat screen: owns the input box, wires the pieces together
src/components/chat/    The chat's pieces: useChatStream (streaming and state), MessageList,
                        MessageBubble, SourceChips, Composer, ExampleQuestions, header and footer
src/components/TeamHelmet.tsx  Pixel-art helmet in a team's colors (animates while loading)
src/components/ui/      shadcn components (button, textarea, badge, skeleton)
src/styles/global.css   Tailwind, theme tokens and markdown styles
src/pages/api/chat.ts   Chat route: streams the model's answer and tool use
src/pages/data.astro    Data check page
src/lib/prompt.ts       System prompt (answer only from tool results)
data/                   Database and downloaded files (gitignored)
PLAN.md                 Architecture and build order
```

## Roadmap

1. ✅ Data loader and SQLite database
2. ✅ Astro project with the Node adapter
3. ✅ Data check page
4. ✅ Model config (Gemini by default, swappable provider)
5. ✅ Database-backed tools (player stats, game logs, games, standings, leaders, read-only SQL)
6. ✅ `/api/chat` route with streaming
7. ✅ Chat page
8. Model-level test set, design polish, public-deployment safeguards (rate limiting), a hosting choice and a data refresh schedule

See [PLAN.md](PLAN.md) for the full list of next steps.

## Data and attribution

Data from [nflverse](https://github.com/nflverse/nflverse-data), licensed [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/). The underlying NFL data belongs to its respective owners and is subject to their terms of use. This project is for personal and educational use.
