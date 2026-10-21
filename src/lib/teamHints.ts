import { resolveTeam } from './queries';
import { TEAM_COLORS } from './teamColors';

// Works out which team(s) a lookup is about, so the UI can show a helmet in
// their colors while the answer loads. Returns up to two team abbreviations.

const TEAM_KEYS = new Set(['team', 'teams', 'home_team', 'away_team']);
const MAX_DEPTH = 4;

/**
 * Looks through a tool's result for team abbreviations.
 * - One or two teams in total (a player's season, one game): all of them.
 * - Many teams (a schedule, standings, a leaderboard): the one that clearly
 *   dominates, e.g. the team whose schedule it is, otherwise none.
 */
export function teamsFromToolResult(output: unknown): string[] {
  const counts = new Map<string, number>();

  const visit = (value: unknown, depth: number) => {
    if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    for (const [key, v] of Object.entries(value)) {
      if (TEAM_KEYS.has(key) && typeof v === 'string') {
        for (const part of v.split(',')) {
          const abbr = part.trim();
          if (abbr in TEAM_COLORS) counts.set(abbr, (counts.get(abbr) ?? 0) + 1);
        }
      } else {
        visit(v, depth + 1);
      }
    }
  };
  visit(output, 0);

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]); // ties keep first-seen order
  if (ranked.length <= 2) return ranked.map(([abbr]) => abbr);
  const [top, second] = ranked;
  return top[1] >= 2 && top[1] > second[1] ? [top[0]] : [];
}

/** A tool call's own input can name a team ("Chiefs") before any data comes back. */
export function teamsFromToolInput(input: unknown): string[] {
  if (input === null || typeof input !== 'object') return [];
  const team = (input as Record<string, unknown>).team;
  if (typeof team !== 'string') return [];
  const abbr = resolveTeam(team).find((a) => a in TEAM_COLORS);
  return abbr ? [abbr] : [];
}
