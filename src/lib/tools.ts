import { tool } from 'ai';
import { z } from 'zod';
import {
  LEADER_STATS,
  findPlayers,
  getGames,
  getPlayerGameLog,
  getPlayerSeasonStats,
  getSeasonLeaders,
  getStandings,
  resolveTeam,
  runReadOnlySql,
  type PlayerMatch,
} from './queries';
import { SCHEMA_NOTES } from './schema';

// The tools the chat model can call. Each one runs a fixed, parameterised query
// against data/nfl.db and returns rows; the model only writes the answer.
// Failures come back as { error } so the model can explain or retry.

const seasonType = z
  .enum(['REG', 'POST', 'ALL'])
  .default('REG')
  .describe('REG = regular season (default), POST = playoffs, ALL = both. Say which one you used in your answer.');

const season = z.number().int().min(1999).describe('NFL season year, e.g. 2023 for the season that ended in the February 2024 Super Bowl');

const playerArg = z
  .string()
  .describe('Player name (e.g. "Patrick Mahomes", "Mahomes") or a player ID like "00-0033873"');

function safe<T>(fn: () => T): T | { error: string } {
  try {
    return fn();
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Resolves a player argument to exactly one player, or explains why it can't. */
function withPlayer(player: string, season: number | null, run: (p: PlayerMatch) => object) {
  return safe(() => {
    const matches = findPlayers(player, season);
    if (matches.length === 0) {
      return { error: `No player found matching "${player}"${season ? ` in ${season}` : ''}.` };
    }
    if (matches.length > 1) {
      return {
        ambiguous: true,
        message: 'Several players match. Ask the user which one they mean (or retry with the player_id).',
        candidates: matches,
      };
    }
    return { player: matches[0], ...run(matches[0]) };
  });
}

export const footballTools = {
  find_player: tool({
    description:
      'Look up players by name. Returns player IDs, positions, and the seasons they played. ' +
      'Use this to check who someone is or to tell apart players who share a name. ' +
      'The stat tools also accept a name directly.',
    inputSchema: z.object({
      name: z.string().describe('Full or partial player name'),
      season: season.optional().describe('Only players who played in this season'),
    }),
    execute: ({ name, season }) => safe(() => ({ matches: findPlayers(name, season ?? null) })),
  }),

  get_player_season_stats: tool({
    description:
      "A player's season totals (one row per season): games played, passing, rushing, receiving, defense, " +
      'kicking, and fantasy stats. Fields that are zero are omitted. Leave season out for the whole career.',
    inputSchema: z.object({
      player: playerArg,
      season: season.optional().describe('Omit for every season of their career'),
      season_type: seasonType,
    }),
    execute: ({ player, season, season_type }) =>
      withPlayer(player, season ?? null, (p) => ({
        season_type,
        seasons: getPlayerSeasonStats(p.player_id, season ?? null, season_type),
      })),
  }),

  get_player_game_log: tool({
    description:
      "A player's stats game by game for one season (week, opponent, and the stats from that game). " +
      'Use for questions about a specific week or a stretch of games.',
    inputSchema: z.object({
      player: playerArg,
      season,
      season_type: seasonType,
    }),
    execute: ({ player, season, season_type }) =>
      withPlayer(player, season, (p) => ({
        season_type,
        games: getPlayerGameLog(p.player_id, season, season_type),
      })),
  }),

  get_games: tool({
    description:
      'Game scores and schedules. Filter by team (name or abbreviation like "KC", "Chiefs"), season, week, or ' +
      'game type. Future games have status "scheduled" and no score. game_type is REG, WC (wild card), ' +
      'DIV (divisional), CON (conference championship), or SB (Super Bowl).',
    inputSchema: z.object({
      team: z.string().optional().describe('Team name or abbreviation'),
      season: season.optional(),
      week: z.number().int().min(1).max(23).optional(),
      game_type: z.enum(['REG', 'WC', 'DIV', 'CON', 'SB']).optional(),
      limit: z.number().int().min(1).max(50).optional().describe('Max games to return (default 25)'),
    }),
    execute: ({ team, season, week, game_type, limit }) =>
      safe(() => {
        const teams = team ? resolveTeam(team) : [];
        if (team && teams.length === 0) return { error: `No team found matching "${team}".` };
        return {
          games: getGames({ teams, season: season ?? null, week: week ?? null, gameType: game_type ?? null, limit }),
        };
      }),
  }),

  get_standings: tool({
    description:
      'Regular-season win-loss records for every team in a season, grouped by division, with points for and against.',
    inputSchema: z.object({ season }),
    execute: ({ season }) => safe(() => getStandings(season)),
  }),

  get_season_leaders: tool({
    description:
      'Leaderboard for one stat in one season (e.g. most rushing yards in 2023). Optionally limit to a position.',
    inputSchema: z.object({
      season,
      stat: z.enum(LEADER_STATS).describe('The stat to rank by'),
      season_type: seasonType,
      position: z.string().optional().describe('Position code such as QB, RB, WR, TE, LB, CB, DE, K'),
      limit: z.number().int().min(1).max(50).optional().describe('How many players (default 25)'),
    }),
    execute: ({ season, stat, season_type, position, limit }) =>
      safe(() => ({
        stat,
        season_type,
        leaders: getSeasonLeaders(season, stat, season_type, position?.toUpperCase() ?? null, limit),
      })),
  }),

  run_sql: tool({
    description:
      'Last resort for questions the other tools cannot answer. Runs ONE read-only SELECT query (max 100 rows) ' +
      'against the database. If it returns an error, read the message, fix the query, and try again. ' +
      'Prefer the other tools whenever they fit.\n\n' +
      SCHEMA_NOTES,
    inputSchema: z.object({
      sql: z.string().describe('A single SQLite SELECT statement'),
    }),
    execute: ({ sql }) => safe(() => runReadOnlySql(sql)),
  }),
};
