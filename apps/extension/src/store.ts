import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  emptyPlaylist,
  type Job,
  type MediaItem,
  type Playlist,
} from "../../../packages/contracts";
export class Store {
  db: DatabaseSync;
  constructor(public directory: string) {
    mkdirSync(directory, { recursive: true });
    this.db = new DatabaseSync(resolve(directory, "komari-ds.db"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, node TEXT NOT NULL, kind TEXT NOT NULL, owner TEXT NOT NULL, value TEXT NOT NULL, created TEXT NOT NULL);",
    );
    const jobs = this.db.prepare("SELECT id,value FROM jobs").all();
    for (const row of jobs) {
      const job = JSON.parse(row.value as string) as Job;
      if (job.state === "queued" || job.state === "running") {
        job.state = "failed";
        job.error = "扩展服务重启，任务未自动重试";
        job.updatedAt = new Date().toISOString();
        this.db
          .prepare("UPDATE jobs SET value=? WHERE id=?")
          .run(JSON.stringify(job), job.id);
      }
    }
  }
  playlist(): Playlist {
    const row = this.db
      .prepare("SELECT value FROM config WHERE key=?")
      .get("playlist");
    return row
      ? JSON.parse(row.value as string)
      : structuredClone(emptyPlaylist);
  }
  readConfig(key: string): unknown {
    const row = this.db
      .prepare("SELECT value FROM config WHERE key=?")
      .get(key);
    try {
      return row ? JSON.parse(row.value as string) : null;
    } catch {
      return null;
    }
  }
  writeConfig(key: string, value: unknown) {
    this.db
      .prepare("INSERT OR REPLACE INTO config(key,value) VALUES(?,?)")
      .run(key, JSON.stringify(value));
  }
  savePlaylist(data: Playlist) {
    this.db
      .prepare("INSERT OR REPLACE INTO config(key,value) VALUES(?,?)")
      .run("playlist", JSON.stringify(data));
  }
  media() {
    return this.db
      .prepare("SELECT value FROM media")
      .all()
      .map((r) => JSON.parse(r.value as string) as MediaItem);
  }
  putMedia(item: MediaItem) {
    this.db
      .prepare("INSERT INTO media(id,value) VALUES(?,?)")
      .run(item.id, JSON.stringify(item));
  }
  removeMedia(id: string) {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("DELETE FROM media WHERE id=?").run(id);
      const p = this.playlist();
      this.savePlaylist({ ...p, items: p.items.filter((i) => i.id !== id) });
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  putJob(job: Job, owner: string) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO jobs(id,node,kind,owner,value,created) VALUES(?,?,?,?,?,?)",
      )
      .run(
        job.id,
        job.nodeId,
        job.kind,
        owner,
        JSON.stringify(job),
        job.createdAt,
      );
  }
  getJob(id: string, owner: string): Job | null {
    const row = this.db
      .prepare("SELECT value FROM jobs WHERE id=? AND owner=?")
      .get(id, owner);
    return row ? JSON.parse(row.value as string) : null;
  }
  latest(node: string, kind: string, owner: string): Job | null {
    const row = this.db
      .prepare(
        "SELECT value FROM jobs WHERE node=? AND kind=? AND owner=? ORDER BY created DESC LIMIT 1",
      )
      .get(node, kind, owner);
    return row ? JSON.parse(row.value as string) : null;
  }
  prune() {
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    this.db.prepare("DELETE FROM jobs WHERE created<?").run(cutoff);
  }
  close() {
    this.db.close();
  }
}
