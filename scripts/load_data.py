"""Download nflverse data and build a local SQLite database.

Data: https://github.com/nflverse/nflverse-data (CC-BY-4.0, credit "nflverse").

Usage:
    .venv/bin/python scripts/load_data.py                    # 1999 through this year
    .venv/bin/python scripts/load_data.py --start 2015       # fewer seasons
"""
from __future__ import annotations

import argparse
import datetime
import sqlite3
from pathlib import Path

import pandas as pd
import requests

BASE = "https://github.com/nflverse/nflverse-data/releases/download"
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
DB = ROOT / "data" / "nfl.db"


def fetch(tag: str, name: str) -> Path | None:
    """Download one parquet file (cached in data/raw). Returns None if it doesn't exist."""
    path = RAW / f"{name}.parquet"
    if path.exists():
        return path
    resp = requests.get(f"{BASE}/{tag}/{name}.parquet", timeout=60)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    path.write_bytes(resp.content)
    return path


def load_one(tag: str, name: str) -> pd.DataFrame | None:
    path = fetch(tag, name)
    return pd.read_parquet(path) if path else None


def load_seasons(tag: str, prefix: str, seasons: range) -> pd.DataFrame:
    frames = []
    for season in seasons:
        df = load_one(tag, f"{prefix}_{season}")
        if df is None:
            print(f"  {prefix}_{season}: not available, skipped")
            continue
        frames.append(df)
    return pd.concat(frames, ignore_index=True)


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """SQLite can't store lists/dicts; stringify any such columns."""
    for col in df.columns:
        if df[col].dtype == object and df[col].map(lambda v: isinstance(v, (list, dict))).any():
            df[col] = df[col].astype(str)
    return df


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=1999)
    parser.add_argument("--end", type=int, default=datetime.date.today().year)
    args = parser.parse_args()
    seasons = range(args.start, args.end + 1)

    RAW.mkdir(parents=True, exist_ok=True)

    tables = {
        "teams": lambda: load_one("teams", "teams_colors_logos"),
        "players": lambda: load_one("players", "players"),
        "games": lambda: load_one("schedules", "games"),
        "rosters": lambda: load_seasons("rosters", "roster", seasons),
        "player_week_stats": lambda: load_seasons("stats_player", "stats_player_week", seasons),
        "team_week_stats": lambda: load_seasons("stats_team", "stats_team_week", seasons),
    }

    tmp = DB.with_suffix(".db.tmp")
    tmp.unlink(missing_ok=True)
    with sqlite3.connect(tmp) as conn:
        for table, build in tables.items():
            print(f"Loading {table}...")
            df = build()
            if df is None:
                raise SystemExit(f"Could not download data for {table}")
            clean(df).to_sql(table, conn, index=False)
            print(f"  {len(df):,} rows, {len(df.columns)} columns")
    tmp.replace(DB)
    print(f"Done: {DB} ({DB.stat().st_size / 1e6:.0f} MB)")


if __name__ == "__main__":
    main()
