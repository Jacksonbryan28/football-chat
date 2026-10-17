import { query, type Row } from './db';

// Plain query functions behind the chat tools. Every value from the model is
// bound as a SQL parameter; column names only ever come from the whitelists below.

export type SeasonType = 'REG' | 'POST' | 'ALL';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

// Stats that add up across games (summed for season totals).
const SUM_COLUMNS = [
  'completions', 'attempts', 'passing_yards', 'passing_tds', 'passing_interceptions',
  'sacks_suffered', 'passing_epa',
  'carries', 'rushing_yards', 'rushing_tds', 'rushing_fumbles_lost',
  'targets', 'receptions', 'receiving_yards', 'receiving_tds',
  'def_tackles_solo', 'def_tackle_assists', 'def_tackles_for_loss', 'def_sacks',
  'def_qb_hits', 'def_interceptions', 'def_pass_defended', 'def_fumbles_forced', 'def_tds',
  'fg_made', 'fg_att', 'pat_made', 'pat_att',
  'pt_att', 'pt_yards',
  'punt_return_yards', 'kickoff_return_yards', 'special_teams_tds',
  'fantasy_points', 'fantasy_points_ppr',
] as const;

// Stats where a season value is the best single game, not a total.
const MAX_COLUMNS = ['fg_long', 'pt_long'] as const;

// Stats the leaderboard tool can rank by.
export const LEADER_STATS = [
  'passing_yards', 'passing_tds', 'passing_interceptions', 'completions',
  'rushing_yards', 'rushing_tds', 'carries',
  'receptions', 'receiving_yards', 'receiving_tds', 'targets',
  'def_sacks', 'def_interceptions', 'def_tackles_solo', 'def_pass_defended',
  'fg_made', 'fantasy_points_ppr',
] as const;
export type LeaderStat = (typeof LEADER_STATS)[number];

/** Drops stat fields that are null or zero so results stay short and relevant to the position. */
function compact(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === 0) continue;
    out[key] = typeof value === 'number' ? Math.round(value * 100) / 100 : value;
  }
  return out;
}

// ---------------------------------------------------------------- players

export interface PlayerMatch extends Row {
  player_id: string;
  name: string;
  position: string | null;
  first_season: number;
  last_season: number;
  latest_team: string | null;
}

const PLAYER_ID = /^\d{2}-\d{7}$/;

/** Finds players by name (or by ID), optionally only those who played in a given season. */
export function findPlayers(nameOrId: string, season: number | null = null, limit = 8): PlayerMatch[] {
  const text = nameOrId.trim().replace(/\s+/g, ' ');
  if (PLAYER_ID.test(text)) {
    return runPlayerSearch('s.player_id = ?', text, season, limit);
  }
  const cleaned = text.replace(/[%_]/g, '');
  const exact = runPlayerSearch('LOWER(s.player_display_name) = LOWER(?)', cleaned, season, limit);
  if (exact.length > 0) return exact;
  return runPlayerSearch('LOWER(s.player_display_name) LIKE LOWER(?)', `%${cleaned}%`, season, limit);
}

function runPlayerSearch(where: string, value: string, season: number | null, limit: number): PlayerMatch[] {
  return query(
    `SELECT s.player_id, s.player_display_name AS name, MAX(s.position) AS position,
            MIN(s.season) AS first_season, MAX(s.season) AS last_season, p.latest_team
     FROM player_week_stats s
     LEFT JOIN players p ON p.gsis_id = s.player_id
     WHERE ${where} AND (? IS NULL OR s.season = ?)
     GROUP BY s.player_id
     ORDER BY last_season DESC, name
     LIMIT ?`,
    value, season, season, limit,
  ) as PlayerMatch[];
}

export function getPlayerSeasonStats(playerId: string, season: number | null, seasonType: SeasonType): Row[] {
  const sums = SUM_COLUMNS.map((c) => `SUM(${c}) AS ${c}`).join(', ');
  const maxes = MAX_COLUMNS.map((c) => `MAX(${c}) AS ${c}`).join(', ');
  return query(
    `SELECT season, GROUP_CONCAT(DISTINCT team) AS teams, COUNT(*) AS games, ${sums}, ${maxes}
     FROM player_week_stats
     WHERE player_id = ?
       AND (? = 'ALL' OR season_type = ?)
       AND (? IS NULL OR season = ?)
     GROUP BY season
     ORDER BY season DESC
     LIMIT ${MAX_LIMIT}`,
    playerId, seasonType, seasonType, season, season,
  ).map(compact);
}

export function getPlayerGameLog(playerId: string, season: number, seasonType: SeasonType): Row[] {
  const cols = [...SUM_COLUMNS, ...MAX_COLUMNS].join(', ');
  return query(
    `SELECT season, week, season_type, team, opponent_team, ${cols}
     FROM player_week_stats
     WHERE player_id = ? AND season = ? AND (? = 'ALL' OR season_type = ?)
     ORDER BY CASE season_type WHEN 'REG' THEN 0 ELSE 1 END, week
     LIMIT ${MAX_LIMIT}`,
    playerId, season, seasonType, seasonType,
  ).map(compact);
}

export function getSeasonLeaders(
  season: number, stat: LeaderStat, seasonType: SeasonType, position: string | null, limit?: number,
): Row[] {
  if (!LEADER_STATS.includes(stat)) throw new Error(`Unsupported stat "${stat}"`);
  return query(
    `SELECT player_id, player_display_name AS name, MAX(position) AS position,
            GROUP_CONCAT(DISTINCT team) AS teams, COUNT(*) AS games, SUM(${stat}) AS ${stat}
     FROM player_week_stats
     WHERE season = ? AND (? = 'ALL' OR season_type = ?) AND (? IS NULL OR position = ?)
     GROUP BY player_id
     HAVING SUM(${stat}) > 0
     ORDER BY SUM(${stat}) DESC, name
     LIMIT ?`,
    season, seasonType, seasonType, position, position, clampLimit(limit),
  );
}

// ------------------------------------------------------------------ teams & games

/**
 * Turns a team name or abbreviation into every abbreviation that franchise
 * used (e.g. "Rams" -> LA, LAR, STL). Returns [] when nothing matches.
 */
export function resolveTeam(input: string): string[] {
  const text = input.trim().replace(/[%_]/g, '');
  if (!text) return [];

  let rows = query(
    `SELECT DISTINCT team_abbr FROM teams WHERE team_name IN (
       SELECT team_name FROM teams WHERE UPPER(team_abbr) = UPPER(?))`,
    text,
  );
  if (rows.length === 0) {
    rows = query(
      `SELECT DISTINCT team_abbr FROM teams
       WHERE LOWER(team_name) LIKE LOWER(?) OR LOWER(team_nick) LIKE LOWER(?)`,
      `%${text}%`, `%${text}%`,
    );
  }
  return rows.map((r) => r.team_abbr as string);
}

export interface GameFilters {
  teams?: string[];
  season?: number | null;
  week?: number | null;
  gameType?: string | null;
  limit?: number;
}

export function getGames({ teams = [], season = null, week = null, gameType = null, limit }: GameFilters): Row[] {
  const marks = teams.map(() => '?').join(', ');
  const teamFilter = teams.length ? `AND (away_team IN (${marks}) OR home_team IN (${marks}))` : '';
  const rows = query(
    `SELECT game_id, season, week, game_type, gameday, away_team, away_score, home_team, home_score,
            overtime, stadium, away_qb_name, home_qb_name
     FROM games
     WHERE (? IS NULL OR season = ?)
       AND (? IS NULL OR week = ?)
       AND (? IS NULL OR game_type = ?)
       ${teamFilter}
     ORDER BY gameday ${season === null ? 'DESC' : 'ASC'}, gametime
     LIMIT ?`,
    season, season, week, week, gameType, gameType, ...teams, ...teams, clampLimit(limit),
  );
  return rows.map((r) => ({ ...r, status: r.home_score === null ? 'scheduled' : 'final' }));
}

export function getStandings(season: number): { rows: Row[]; note: string } {
  const rows = query(
    `WITH g AS (
       SELECT home_team AS team, home_score AS pf, away_score AS pa FROM games
         WHERE season = ? AND game_type = 'REG' AND home_score IS NOT NULL
       UNION ALL
       SELECT away_team, away_score, home_score FROM games
         WHERE season = ? AND game_type = 'REG' AND home_score IS NOT NULL
     )
     SELECT t.team_division AS division, g.team, t.team_name,
            SUM(g.pf > g.pa) AS wins, SUM(g.pf < g.pa) AS losses, SUM(g.pf = g.pa) AS ties,
            SUM(g.pf) AS points_for, SUM(g.pa) AS points_against
     FROM g LEFT JOIN teams t ON t.team_abbr = g.team
     GROUP BY g.team
     ORDER BY division, wins DESC, ties DESC, points_for - points_against DESC`,
    season, season,
  );
  return {
    rows,
    note: 'Regular season only. Sorted by wins; official tiebreakers are not applied. '
      + 'Divisions use current alignment, so they are only reliable for 2002 onward.',
  };
}

// ------------------------------------------------------------------ free-form SQL

const SQL_LIMIT = 100;
const FORBIDDEN = /\b(attach|detach|pragma|insert|update|delete|drop|alter|create|replace|vacuum|reindex)\b/i;

export function runReadOnlySql(sql: string): { rows: Row[]; truncated: boolean } {
  const text = sql.trim().replace(/;+\s*$/, '');
  if (!/^(select|with)\b/i.test(text)) throw new Error('Only SELECT queries are allowed.');
  if (text.includes(';')) throw new Error('Only a single statement is allowed.');
  if (FORBIDDEN.test(text)) throw new Error('That statement type is not allowed.');

  const rows = query(`SELECT * FROM (${text}) LIMIT ${SQL_LIMIT + 1}`);
  return { rows: rows.slice(0, SQL_LIMIT), truncated: rows.length > SQL_LIMIT };
}
