import { describe, expect, it } from 'vitest';
import { teamsFromToolInput, teamsFromToolResult } from './teamHints';
import { TEAM_COLORS } from './teamColors';
import { footballTools } from './tools';

async function call(name: keyof typeof footballTools, input: Record<string, unknown>) {
  const t = footballTools[name] as { execute: (i: unknown, o: unknown) => Promise<any> | any };
  return await t.execute(input, { toolCallId: 'test', messages: [] });
}

describe('team colors', () => {
  it('has colors for every team the games table uses', () => {
    expect(Object.keys(TEAM_COLORS)).toEqual(expect.arrayContaining(['KC', 'SF', 'LA', 'LAC', 'LV', 'WAS']));
    for (const colors of Object.values(TEAM_COLORS)) {
      expect(colors.shell).toMatch(/^#[0-9A-F]{6}$/);
      expect(colors.stripe).toMatch(/^#[0-9A-F]{6}$/);
      expect(colors.accent).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('teamsFromToolResult', () => {
  it("finds a player's team", async () => {
    const res = await call('get_player_season_stats', { player: 'Mahomes', season: 2023, season_type: 'REG' });
    expect(teamsFromToolResult(res)).toEqual(['KC']);
  });

  it('finds both teams in a single game', async () => {
    const res = await call('get_games', { season: 2023, game_type: 'SB' });
    expect([...teamsFromToolResult(res)].sort()).toEqual(['KC', 'SF']);
  });

  it("picks the subject of a team's schedule, not every opponent", async () => {
    const res = await call('get_games', { team: 'KC', season: 2023 });
    expect(teamsFromToolResult(res)).toEqual(['KC']);
  });

  it('returns nothing when no team stands out (standings, leaderboards)', async () => {
    expect(teamsFromToolResult(await call('get_standings', { season: 2023 }))).toEqual([]);
    expect(
      teamsFromToolResult(await call('get_season_leaders', { season: 2023, stat: 'rushing_yards', season_type: 'REG' })),
    ).toEqual([]);
  });

  it('ignores unrelated values and unknown abbreviations', () => {
    expect(teamsFromToolResult({ rows: [{ team: 'ZZZ' }, { name: 'KC' }] })).toEqual([]);
    expect(teamsFromToolResult(null)).toEqual([]);
    expect(teamsFromToolResult('KC')).toEqual([]);
  });
});

describe('teamsFromToolInput', () => {
  it('resolves team names and abbreviations', () => {
    expect(teamsFromToolInput({ team: 'Chiefs' })).toEqual(['KC']);
    expect(teamsFromToolInput({ team: 'kc' })).toEqual(['KC']);
    expect(teamsFromToolInput({ team: 'Rams' })).toHaveLength(1);
  });

  it('returns nothing when there is no team to resolve', () => {
    expect(teamsFromToolInput({ player: 'Mahomes' })).toEqual([]);
    expect(teamsFromToolInput({ team: 'Nonexistent FC' })).toEqual([]);
    expect(teamsFromToolInput(undefined)).toEqual([]);
  });
});
