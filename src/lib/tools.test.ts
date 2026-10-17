import { describe, expect, it } from 'vitest';
import {
  findPlayers,
  getGames,
  getPlayerGameLog,
  getPlayerSeasonStats,
  getSeasonLeaders,
  getStandings,
  resolveTeam,
  runReadOnlySql,
} from './queries';
import { footballTools } from './tools';

// Known-answer checks: real NFL results compared with what the database returns.
// Requires data/nfl.db (run scripts/load_data.py first).

const MAHOMES = '00-0033873';

// Calls a tool's execute function the way the AI SDK would.
async function call(name: keyof typeof footballTools, input: Record<string, unknown>) {
  const t = footballTools[name] as { execute: (i: unknown, o: unknown) => Promise<any> | any };
  return await t.execute(input, { toolCallId: 'test', messages: [] });
}

describe('players', () => {
  it('finds Patrick Mahomes by partial name', () => {
    const matches = findPlayers('mahomes');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ name: 'Patrick Mahomes', player_id: MAHOMES, position: 'QB' });
  });

  it('reports every player who shares a name', () => {
    expect(findPlayers('Josh Allen').length).toBeGreaterThanOrEqual(2);
  });

  it('returns nothing for a made-up name', () => {
    expect(findPlayers('Zzyzx Notaplayer')).toEqual([]);
  });
});

describe('player stats', () => {
  it("Mahomes' 2023 regular season totals", () => {
    const [row] = getPlayerSeasonStats(MAHOMES, 2023, 'REG');
    expect(row).toMatchObject({ season: 2023, teams: 'KC', games: 16, passing_yards: 4183, passing_tds: 27 });
  });

  it('omits stats that are zero (no kicking stats for a QB)', () => {
    const [row] = getPlayerSeasonStats(MAHOMES, 2023, 'REG');
    expect(row).not.toHaveProperty('fg_made');
  });

  it('career view returns one row per season, newest first', () => {
    const rows = getPlayerSeasonStats(MAHOMES, null, 'REG');
    expect(rows.length).toBeGreaterThanOrEqual(8);
    const seasons = rows.map((r) => r.season as number);
    expect(seasons).toEqual([...seasons].sort((a, b) => b - a));
  });

  it('game log has one row per game, in week order', () => {
    const log = getPlayerGameLog(MAHOMES, 2023, 'REG');
    expect(log).toHaveLength(16);
    expect(log[0]).toMatchObject({ week: 1, opponent_team: 'DET' });
  });
});

describe('leaders', () => {
  it('2023 passing yards leader is Tua Tagovailoa', () => {
    const [top] = getSeasonLeaders(2023, 'passing_yards', 'REG', null, 3);
    expect(top).toMatchObject({ name: 'Tua Tagovailoa', passing_yards: 4624 });
  });

  it('2023 rushing yards leader is Christian McCaffrey', () => {
    const [top] = getSeasonLeaders(2023, 'rushing_yards', 'REG', null, 3);
    expect(top).toMatchObject({ name: 'Christian McCaffrey', rushing_yards: 1459 });
  });

  it('2023 receiving yards leader among WRs is Tyreek Hill', () => {
    const [top] = getSeasonLeaders(2023, 'receiving_yards', 'REG', 'WR', 3);
    expect(top).toMatchObject({ name: 'Tyreek Hill', receiving_yards: 1799 });
  });
});

describe('teams and games', () => {
  it('resolves names and abbreviations to every abbreviation a franchise used', () => {
    expect(resolveTeam('KC')).toEqual(['KC']);
    expect(resolveTeam('Chiefs')).toEqual(['KC']);
    expect(resolveTeam('Rams').sort()).toEqual(['LA', 'LAR', 'STL']);
    expect(resolveTeam('Nonexistent FC')).toEqual([]);
  });

  it('Super Bowl LVIII: Chiefs 25, 49ers 22', () => {
    const [game] = getGames({ season: 2023, gameType: 'SB' });
    expect(game).toMatchObject({ away_team: 'SF', away_score: 22, home_team: 'KC', home_score: 25, status: 'final' });
  });

  it('Chiefs had 17 regular-season games in 2023', () => {
    expect(getGames({ teams: resolveTeam('KC'), season: 2023, gameType: 'REG' })).toHaveLength(17);
  });

  it('marks games without a score as scheduled and the rest as final', () => {
    // Doesn't depend on today's date: whatever the current season holds, status must match the score.
    const games = getGames({ season: new Date().getFullYear(), limit: 50 });
    for (const g of games) {
      expect(g.status).toBe(g.home_score === null ? 'scheduled' : 'final');
    }
  });
});

describe('standings', () => {
  it('2023 records: Chiefs 11-6, Ravens 13-4, Cowboys 12-5', () => {
    const { rows } = getStandings(2023);
    const rec = (team: string) => {
      const r = rows.find((x) => x.team === team)!;
      return `${r.wins}-${r.losses}`;
    };
    expect(rec('KC')).toBe('11-6');
    expect(rec('BAL')).toBe('13-4');
    expect(rec('DAL')).toBe('12-5');
    expect(rows).toHaveLength(32);
  });
});

describe('run_sql', () => {
  it('runs a read-only SELECT', () => {
    const { rows } = runReadOnlySql("SELECT COUNT(*) AS n FROM games WHERE season = 2023 AND game_type = 'SB'");
    expect(rows).toEqual([{ n: 1 }]);
  });

  it('caps results at 100 rows and says so', () => {
    const { rows, truncated } = runReadOnlySql('SELECT * FROM player_week_stats');
    expect(rows).toHaveLength(100);
    expect(truncated).toBe(true);
  });

  it.each([
    'DROP TABLE games',
    'DELETE FROM games',
    "INSERT INTO teams (team_abbr) VALUES ('X')",
    'SELECT 1; DROP TABLE games',
    'PRAGMA table_info(games)',
    "ATTACH DATABASE 'x.db' AS x",
  ])('rejects %s', (sql) => {
    expect(() => runReadOnlySql(sql)).toThrow();
  });
});

describe('tools (as the model calls them)', () => {
  it('get_player_season_stats resolves a name and returns totals', async () => {
    const res = await call('get_player_season_stats', { player: 'Mahomes', season: 2023, season_type: 'REG' });
    expect(res.player.name).toBe('Patrick Mahomes');
    expect(res.seasons[0].passing_yards).toBe(4183);
  });

  it('asks which player when a name is ambiguous', async () => {
    const res = await call('get_player_season_stats', { player: 'Josh Allen', season_type: 'REG' });
    expect(res.ambiguous).toBe(true);
    expect(res.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('returns an error object for unknown players and teams instead of throwing', async () => {
    expect((await call('get_player_game_log', { player: 'Zzyzx Notaplayer', season: 2023, season_type: 'REG' })).error).toMatch(/No player/);
    expect((await call('get_games', { team: 'Nonexistent FC' })).error).toMatch(/No team/);
  });

  it('run_sql reports SQL mistakes so the model can fix them', async () => {
    const res = await call('run_sql', { sql: 'SELECT nonexistent_column FROM games' });
    expect(res.error).toMatch(/nonexistent_column/);
  });
});
