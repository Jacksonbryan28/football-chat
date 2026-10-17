import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

// Read-only handle to the SQLite file built by scripts/load_data.py.
const db = new DatabaseSync(path.join(process.cwd(), 'data', 'nfl.db'), { readOnly: true });

export type Row = Record<string, string | number | null>;

export function query(sql: string, ...params: (string | number | null)[]): Row[] {
  return db.prepare(sql).all(...params) as Row[];
}

export const TABLES = [
  'teams',
  'players',
  'games',
  'rosters',
  'player_week_stats',
  'team_week_stats',
];

export function tableCounts(): Row[] {
  return TABLES.map((table) => ({
    table,
    rows: (query(`SELECT COUNT(*) AS n FROM ${table}`)[0].n as number),
  }));
}

export function searchPlayerSeasons(name: string, season: number | null): Row[] {
  return query(
    `SELECT player_display_name AS player, position, season, MAX(team) AS team,
            COUNT(*) AS games,
            SUM(passing_yards) AS pass_yds, SUM(passing_tds) AS pass_td,
            SUM(rushing_yards) AS rush_yds, SUM(rushing_tds) AS rush_td,
            SUM(receptions) AS rec, SUM(receiving_yards) AS rec_yds, SUM(receiving_tds) AS rec_td
     FROM player_week_stats
     WHERE season_type = 'REG'
       AND player_display_name LIKE ?
       AND (? = 0 OR season = ?)
     GROUP BY player_id, season
     ORDER BY season DESC, player
     LIMIT 50`,
    `%${name}%`,
    season ?? 0,
    season ?? 0,
  );
}

export function searchGames(team: string, season: number | null): Row[] {
  return query(
    `SELECT season, week, game_type AS type, gameday AS date,
            away_team AS away, away_score, home_team AS home, home_score
     FROM games
     WHERE (away_team = ? OR home_team = ?)
       AND (? = 0 OR season = ?)
     ORDER BY gameday DESC
     LIMIT 50`,
    team.toUpperCase(),
    team.toUpperCase(),
    season ?? 0,
    season ?? 0,
  );
}
