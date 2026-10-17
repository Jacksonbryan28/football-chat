// Plain-English description of the database, shown to the model (run_sql tool
// description and, later, the chat system prompt).
export const SCHEMA_NOTES = `
SQLite database of NFL data from nflverse, seasons 1999 to the current season.

Tables:
- teams(team_abbr, team_name, team_nick, team_conf, team_division, ...): one row per team abbreviation. Franchises that moved have several rows (e.g. Rams: LA, LAR, STL; Raiders: OAK, LV; Chargers: SD, LAC).
- players(gsis_id, display_name, position, latest_team, rookie_season, last_season, college_name, draft_year, draft_round, draft_pick, ...): one row per player. gsis_id is the player ID.
- games(game_id, season, game_type, week, gameday, away_team, away_score, home_team, home_score, result, total, overtime, stadium, away_qb_name, home_qb_name, away_coach, home_coach, spread_line, total_line, roof, surface, temp, wind, ...): one row per game. game_type is REG (regular season), WC, DIV, CON, or SB (Super Bowl). result = home_score - away_score. Scores are NULL for games not yet played.
- rosters(season, team, position, full_name, gsis_id, jersey_number, status, ...): team rosters by season.
- player_week_stats(player_id, player_display_name, position, season, week, season_type, team, opponent_team, ...stats): one row per player per game played. player_id matches players.gsis_id. season_type is REG or POST. Stat columns include passing_yards, passing_tds, passing_interceptions, completions, attempts, carries, rushing_yards, rushing_tds, targets, receptions, receiving_yards, receiving_tds, def_sacks, def_interceptions, def_tackles_solo, def_pass_defended, fg_made, fg_att, fantasy_points_ppr, and many more. Sum them across rows for season totals.
- team_week_stats: same stat columns as player_week_stats, but per team per game (team, opponent_team, season, week, season_type).

Notes:
- Team abbreviations in games and stats use the nflverse spelling (e.g. LA for the Rams since 2016, LV, LAC).
- Names can be shared by different players; join on IDs, not names.
- There is no play-by-play data, so situational questions (third downs, red zone, quarter-by-quarter) cannot be answered.
`.trim();
