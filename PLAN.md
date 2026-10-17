# football-chat plan

**Goal:** a chat app where you ask NFL questions and get answers based on real data, not the model's memory.

## Architecture

```
nflverse (online) → Python loader → SQLite file → Astro server (/api/chat) → LLM (with tools) → chat UI
```

- **Data:** free NFL stats from [nflverse](https://github.com/nflverse/nflverse-data) (CC-BY-4.0, so the app needs a "Data from nflverse" credit).
- **Approach:** tool use, not RAG. The model calls tools like `get_player_stats` or `run_sql`, our code queries the database, and the model writes the answer from the exact rows returned.
- **Database:** a single SQLite file (`data/nfl.db`), gitignored.
- **UI and server:** Astro with the Node adapter. The `/api/chat` route holds the API key and runs the queries.
- **Model:** Gemini free tier to start, behind a provider abstraction (Vercel AI SDK) so we can swap to Claude or Ollama by changing environment variables.

## Data to load first

Teams, players, schedules, rosters, weekly player stats and weekly team stats. Estimated size is about 100–200 MB for the database. Play-by-play is left out because it is very large; add recent seasons later if needed.

## Build order

1. **Loader:** a Python script using `nflreadpy` that builds the SQLite database. Then inspect the tables and columns.
2. **Astro project:** set it up in this repo with the Node adapter.
3. **Model config:** one module that picks the provider and model from `.env`.
4. **Tools:** database-backed tools (player stats, game results, standings, maybe read-only SQL).
5. **Chat route:** `/api/chat` with streaming.
6. **Chat page:** a simple UI with streaming responses.
7. **Testing:** 20–30 known-answer questions to compare models and catch bad answers.

## Rules for the app

- The system prompt tells the model to answer only from tool results, and to say "I don't know" if the data doesn't have it.
- Cite which data each answer came from.
- The API key lives in `.env`, never in browser code.
- `.env`, `data/` and the database file are gitignored.

## Open items

- Current Gemini model names, free-tier rate limits, and data-use terms (free-tier prompts may be used by Google; fine for public stats).
- Exact column names in the stats tables.
- Hosting: SQLite needs a persistent disk (Railway, Render, Fly.io, or a VPS), not serverless platforms like Vercel or Netlify.
- If this ever becomes public or commercial, review NFL data terms and rate limits.
