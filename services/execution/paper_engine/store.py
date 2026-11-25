"""SQLite-backed durable snapshots and append-only journal for PAPER execution only."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from contextlib import closing
from typing import Any, Mapping


class SQLitePaperStore:
    """Local durable store. No network, broker, credential, or order-dispatch capability."""

    SCHEMA_VERSION = 1

    def __init__(self, database_path: str | Path):
        self.database_path = str(database_path)
        if self.database_path != ":memory:":
            Path(self.database_path).expanduser().parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS paper_state (
                    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
                    schema_version INTEGER NOT NULL,
                    snapshot_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS paper_event_journal (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    event_json TEXT NOT NULL,
                    occurred_at TEXT NOT NULL
                );
                """
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=10.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout = 10000")
        connection.execute("PRAGMA synchronous = FULL")
        if self.database_path != ":memory:":
            connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def save_snapshot(
        self,
        snapshot: Mapping[str, Any],
        *,
        event_type: str,
        event: Mapping[str, Any],
        occurred_at: str,
    ) -> None:
        """Atomically commit current state and its journal event."""
        snapshot_json = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
        event_json = json.dumps(event, sort_keys=True, separators=(",", ":"))
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                """
                INSERT INTO paper_state(singleton_id, schema_version, snapshot_json, updated_at)
                VALUES(1, ?, ?, ?)
                ON CONFLICT(singleton_id) DO UPDATE SET
                    schema_version=excluded.schema_version,
                    snapshot_json=excluded.snapshot_json,
                    updated_at=excluded.updated_at
                """,
                (self.SCHEMA_VERSION, snapshot_json, occurred_at),
            )
            connection.execute(
                "INSERT INTO paper_event_journal(event_type, event_json, occurred_at) VALUES(?, ?, ?)",
                (event_type, event_json, occurred_at),
            )
            connection.commit()

    def load_snapshot(self) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT schema_version, snapshot_json FROM paper_state WHERE singleton_id=1"
            ).fetchone()
        if row is None:
            return None
        if row["schema_version"] != self.SCHEMA_VERSION:
            raise RuntimeError("Unsupported PAPER storage schema version")
        payload = json.loads(row["snapshot_json"])
        if not isinstance(payload, dict):
            raise RuntimeError("Stored PAPER snapshot is malformed")
        return payload

    def read_events(self, *, after_sequence: int = 0) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT sequence, event_type, event_json, occurred_at
                FROM paper_event_journal WHERE sequence > ? ORDER BY sequence
                """,
                (after_sequence,),
            ).fetchall()
        return [
            {
                "sequence": row["sequence"],
                "event_type": row["event_type"],
                "event": json.loads(row["event_json"]),
                "occurred_at": row["occurred_at"],
            }
            for row in rows
        ]
