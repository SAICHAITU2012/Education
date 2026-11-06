import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AttemptRecord, TeacherState } from '../core/types.js';

interface DbFile {
  version: 1;
  savedAt: string;
  teachers: Record<string, TeacherState>;
  records: Record<string, AttemptRecord>;
}

/**
 * Small durable store for the V0 server.
 *
 * - Records are keyed by client-generated attempt id → sync is idempotent.
 * - Writes are serialised and atomic (temp file + rename) so a crash cannot
 *   leave a half-written database.
 * - No names, emails or employee ids are ever stored — only a pseudonymous id
 *   generated on the device.
 */
export class Store {
  private teachers = new Map<string, TeacherState>();
  private records = new Map<string, AttemptRecord>();
  private writeQueue: Promise<void> = Promise.resolve();
  private dirty = false;

  constructor(private readonly filePath?: string) {
    if (filePath && existsSync(filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as DbFile;
        if (parsed.version === 1) {
          for (const [id, state] of Object.entries(parsed.teachers ?? {})) this.teachers.set(id, state);
          for (const [id, record] of Object.entries(parsed.records ?? {})) this.records.set(id, record);
        }
      } catch (err) {
        console.error(`[abhyas] could not read store ${filePath}:`, err);
      }
    }
  }

  getTeacher(id: string): TeacherState | undefined {
    return this.teachers.get(id);
  }

  upsertTeacher(state: TeacherState): void {
    this.teachers.set(state.profile.id, state);
    this.touch();
  }

  deleteTeacher(id: string): { removedAttempts: number } {
    this.teachers.delete(id);
    let removedAttempts = 0;
    for (const [attemptId, record] of this.records) {
      if (record.attempt.teacherId === id) {
        this.records.delete(attemptId);
        removedAttempts++;
      }
    }
    this.touch();
    return { removedAttempts };
  }

  hasRecord(id: string): boolean {
    return this.records.has(id);
  }

  getRecord(id: string): AttemptRecord | undefined {
    return this.records.get(id);
  }

  addRecord(record: AttemptRecord): void {
    this.records.set(record.attempt.id, record);
    this.touch();
  }

  listRecords(teacherId: string): AttemptRecord[] {
    return [...this.records.values()]
      .filter((r) => r.attempt.teacherId === teacherId)
      .sort((a, b) => (a.attempt.clientCreatedAt < b.attempt.clientCreatedAt ? 1 : -1));
  }

  allRecords(): AttemptRecord[] {
    return [...this.records.values()];
  }

  countTeachers(): number {
    return this.teachers.size;
  }

  countRecords(): number {
    return this.records.size;
  }

  /** Flush pending writes. Called on shutdown and by tests. */
  async flush(): Promise<void> {
    await this.writeQueue;
  }

  private touch(): void {
    this.dirty = true;
    if (!this.filePath) return;
    this.writeQueue = this.writeQueue
      .then(() => this.persist())
      .catch((err) => console.error('[abhyas] store write failed:', err));
  }

  private async persist(): Promise<void> {
    if (!this.filePath || !this.dirty) return;
    this.dirty = false;
    const payload: DbFile = {
      version: 1,
      savedAt: new Date().toISOString(),
      teachers: Object.fromEntries(this.teachers),
      records: Object.fromEntries(this.records),
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(payload), 'utf8');
    renameSync(tmp, this.filePath);
  }
}
