/**
 * SQLite-based storage for usage entries and snapshots.
 * Uses Bun's native SQLite support for persistence.
 */

import { Database } from "bun:sqlite"
import type { UsageEntry, UsageSnapshot } from "./types"

export class UsageStorage {
  private db: Database

  constructor(path: string) {
    this.db = new Database(path)
    this.init()
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        timestamp INTEGER,
        provider TEXT,
        model TEXT,
        sessionID TEXT,
        agent TEXT,
        inputTokens INTEGER,
        outputTokens INTEGER,
        cost REAL
      )
    `)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER,
        provider TEXT,
        data TEXT
      )
    `)
  }

  addEntry(entry: UsageEntry) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entries (id, timestamp, provider, model, sessionID, agent, inputTokens, outputTokens, cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      entry.id,
      entry.timestamp,
      entry.provider,
      entry.model,
      entry.sessionID,
      entry.agent ?? null,
      entry.inputTokens,
      entry.outputTokens,
      entry.cost ?? 0,
    )
  }

  addSnapshot(snapshot: UsageSnapshot) {
    const stmt = this.db.prepare(`
      INSERT INTO snapshots (timestamp, provider, data)
      VALUES (?, ?, ?)
    `)
    stmt.run(snapshot.timestamp, snapshot.provider, JSON.stringify(snapshot))
  }

  getEntries(days: number = 7): UsageEntry[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const stmt = this.db.prepare("SELECT * FROM entries WHERE timestamp > ? ORDER BY timestamp DESC")
    return stmt.all(cutoff) as any[]
  }

  getLatestSnapshots(): UsageSnapshot[] {
    const stmt = this.db.prepare(`
      SELECT s1.* FROM snapshots s1
      JOIN (SELECT provider, MAX(timestamp) as max_ts FROM snapshots GROUP BY provider) s2
      ON s1.provider = s2.provider AND s1.timestamp = s2.max_ts
    `)
    return stmt.all().map((row: any) => JSON.parse(row.data))
  }
}
