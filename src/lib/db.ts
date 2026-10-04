import { PrismaClient } from '@prisma/client'
import { createClient, type Client } from '@libsql/client'

/**
 * Database client — dual mode:
 *
 * LOCAL DEV: PrismaClient with local SQLite (file:./db/custom.db)
 * PRODUCTION (Vercel): Raw @libsql/client to Turso (bypasses Prisma adapter bug)
 *
 * The @prisma/adapter-libsql v6 has a bug where Prisma's internal engine
 * still validates DATABASE_URL even with the adapter, causing URL_INVALID
 * errors on serverless. So for production, we use the raw libSQL client
 * with a Prisma-compatible API wrapper.
 *
 * On Vercel, set:
 *   TURSO_DATABASE_URL=libsql://your-db.turso.io
 *   TURSO_AUTH_TOKEN=eyJhbGciOi...
 */

// Minimal type that covers what the app uses
interface DbLike {
  // Models used by the app
  rightsArticle: { count: (opts?: { where?: Record<string, unknown> }) => Promise<number>; findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; include?: Record<string, unknown> }) => Promise<unknown[]> };
  rightsTopic: { findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; include?: Record<string, unknown> }) => Promise<unknown[]>; findUnique: (opts?: { where?: Record<string, unknown> }) => Promise<unknown | null> };
  policeStation: { count: (opts?: { where?: Record<string, unknown> }) => Promise<number>; findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number; select?: Record<string, boolean> }) => Promise<unknown[]> };
  emergencyScenario: { count: () => Promise<number>; findMany: () => Promise<unknown[]> };
  helpline: { findMany: (opts?: { orderBy?: Record<string, string> }) => Promise<unknown[]>; count: () => Promise<number> };
  judge: { findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) => Promise<unknown[]>; count: (opts?: { where?: Record<string, unknown> }) => Promise<number> };
  sCJudgment: { count: (opts?: { where?: Record<string, unknown> }) => Promise<number>; findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number; select?: Record<string, boolean> }) => Promise<unknown[]> };
  legalInfoArticle: { count: (opts?: { where?: Record<string, unknown> }) => Promise<number>; findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) => Promise<unknown[]>; findUnique: (opts?: { where?: Record<string, unknown> }) => Promise<unknown | null> };
  documentTemplate: { findMany: (opts?: { orderBy?: Record<string, string> }) => Promise<unknown[]> };
  bookmark: { findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) => Promise<unknown[]>; create: (opts?: { data?: Record<string, unknown> }) => Promise<unknown>; deleteMany: (opts?: { where?: Record<string, unknown> }) => Promise<unknown>; upsert: (opts?: { where?: Record<string, unknown>; create?: Record<string, unknown>; update?: Record<string, unknown> }) => Promise<unknown> };
  feedback: { create: (opts?: { data?: Record<string, unknown> }) => Promise<unknown>; findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; include?: Record<string, boolean> }) => Promise<unknown[]> };
  contentReport: { findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; include?: Record<string, boolean> }) => Promise<unknown[]> };
  auditLog: { create: (opts?: { data?: Record<string, unknown> }) => Promise<unknown>; findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number }) => Promise<unknown[]> };
  profile: { findUnique: (opts?: { where?: Record<string, unknown> }) => Promise<unknown | null>; create: (opts?: { data?: Record<string, unknown> }) => Promise<unknown>; upsert: (opts?: { where?: Record<string, unknown>; create?: Record<string, unknown>; update?: Record<string, unknown> }) => Promise<unknown> };
  user: { findUnique: (opts?: { where?: Record<string, unknown> }) => Promise<unknown | null>; create: (opts?: { data?: Record<string, unknown> }) => Promise<unknown>; update: (opts?: { where?: Record<string, unknown>; data?: Record<string, unknown> }) => Promise<unknown>; delete: (opts?: { where?: Record<string, unknown> }) => Promise<unknown>; findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; include?: Record<string, boolean> }) => Promise<unknown[]>; upsert: (opts?: { where?: Record<string, unknown>; create?: Record<string, unknown>; update?: Record<string, unknown> }) => Promise<unknown> };
  chatSession: { findFirst: (opts?: { where?: Record<string, unknown> }) => Promise<unknown | null>; create: (opts?: { data?: Record<string, unknown> }) => Promise<unknown>; findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; include?: Record<string, unknown> }) => Promise<unknown[]>; deleteMany: (opts?: { where?: Record<string, unknown> }) => Promise<unknown> };
  chatMessage: { create: (opts?: { data?: Record<string, unknown> }) => Promise<unknown>; update: (opts?: { where?: Record<string, unknown>; data?: Record<string, unknown> }) => Promise<unknown> };
  contentReview: { create: (opts?: { data?: Record<string, unknown> }) => Promise<unknown> };
  groqKeyUsage: { upsert: (opts?: { where?: Record<string, unknown>; create?: Record<string, unknown>; update?: Record<string, unknown> }) => Promise<unknown>; findMany: (opts?: { where?: Record<string, unknown> }) => Promise<unknown[]> };
}

class LibSqlDb implements DbLike {
  private client: Client;

  constructor(url: string, token: string) {
    this.client = createClient({ url, authToken: token });
  }

  private buildWhere(where?: Record<string, unknown>): { sql: string; args: unknown[] } {
    if (!where || typeof where !== 'object') return { sql: '', args: [] };
    const conditions: string[] = [];
    const args: unknown[] = [];
    for (const [key, val] of Object.entries(where)) {
      if (val === null || val === undefined) continue;
      if (key === 'OR') {
        const orArr = val as Record<string, unknown>[];
        const orParts: string[] = [];
        for (const cond of orArr) {
          const sub = this.buildWhere(cond);
          if (sub.sql) { orParts.push(`(${sub.sql})`); args.push(...sub.args); }
        }
        if (orParts.length) conditions.push(`(${orParts.join(' OR ')})`);
        continue;
      }
      if (typeof val === 'object' && val !== null) {
        const v = val as Record<string, unknown>;
        if ('contains' in v) { conditions.push(`"${key}" LIKE ?`); args.push(`%${v.contains}%`); }
        else if ('equals' in v) { conditions.push(`"${key}" = ?`); args.push(v.equals); }
      } else {
        conditions.push(`"${key}" = ?`); args.push(val);
      }
    }
    return { sql: conditions.join(' AND '), args };
  }

  private async rawQuery(table: string, opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number; include?: Record<string, unknown> }): Promise<Record<string, unknown>[]> {
    let sql = `SELECT * FROM "${table}"`;
    const args: unknown[] = [];
    const w = this.buildWhere(opts?.where);
    if (w.sql) sql += ` WHERE ${w.sql}`;
    if (opts?.orderBy) {
      const [col, dir] = Object.entries(opts.orderBy)[0];
      sql += ` ORDER BY "${col}" ${dir || 'ASC'}`;
    } else {
      sql += ` ORDER BY "createdAt" DESC`;
    }
    if (opts?.take) { sql += ` LIMIT ${opts.take}`; if (opts?.skip) sql += ` OFFSET ${opts.skip}`; }
    const r = await this.client.execute({ sql, args });
    return r.rows.map(row => {
      const obj: Record<string, unknown> = {};
      for (const col of r.columns) obj[col] = (row as Record<string, unknown>)[col];
      return obj;
    });
  }

  private async rawCount(table: string, where?: Record<string, unknown>): Promise<number> {
    let sql = `SELECT COUNT(*) as n FROM "${table}"`;
    const args: unknown[] = [];
    const w = this.buildWhere(where);
    if (w.sql) sql += ` WHERE ${w.sql}`;
    const r = await this.client.execute({ sql, args });
    return Number(r.rows[0]?.n ?? 0);
  }

  private async rawInsert(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = cols.map(() => '?').join(',');
    await this.client.execute({ sql: `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`, args: vals });
    return data;
  }

  private async rawUpdate(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
    const setCols = Object.keys(data).map(c => `"${c}"=?`).join(',');
    const args: unknown[] = [...Object.values(data)];
    const w = this.buildWhere(where);
    if (w.sql) { args.push(...w.args); await this.client.execute({ sql: `UPDATE "${table}" SET ${setCols} WHERE ${w.sql}`, args }); }
    else { await this.client.execute({ sql: `UPDATE "${table}" SET ${setCols}`, args }); }
  }

  private async rawDelete(table: string, where: Record<string, unknown>): Promise<void> {
    const w = this.buildWhere(where);
    if (w.sql) await this.client.execute({ sql: `DELETE FROM "${table}" WHERE ${w.sql}`, args: w.args });
  }

  private async rawUpsert(table: string, opts: { where?: Record<string, unknown>; create?: Record<string, unknown>; update?: Record<string, unknown> }): Promise<Record<string, unknown>> {
    // Try to find existing
    const w = this.buildWhere(opts.where);
    if (w.sql) {
      const existing = await this.client.execute({ sql: `SELECT * FROM "${table}" WHERE ${w.sql} LIMIT 1`, args: w.args });
      if (existing.rows.length > 0) {
        if (opts.update) { await this.rawUpdate(table, opts.where, opts.update); }
        const obj: Record<string, unknown> = {};
        for (const col of existing.columns) obj[col] = (existing.rows[0] as Record<string, unknown>)[col];
        return obj;
      }
    }
    // Insert new
    return this.rawInsert(table, opts.create || opts.update || {});
  }

  private async rawFindUnique(table: string, where?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (!where) return null;
    const w = this.buildWhere(where);
    if (!w.sql) return null;
    const r = await this.client.execute({ sql: `SELECT * FROM "${table}" WHERE ${w.sql} LIMIT 1`, args: w.args });
    if (!r.rows.length) return null;
    const obj: Record<string, unknown> = {};
    for (const col of r.columns) obj[col] = (r.rows[0] as Record<string, unknown>)[col];
    return obj;
  }

  // Model accessors
  rightsArticle = {
    count: (opts?: { where?: Record<string, unknown> }) => this.rawCount('RightsArticle', opts?.where),
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; include?: Record<string, unknown> }) => this.rawQuery('RightsArticle', opts),
  };
  rightsTopic = {
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; include?: Record<string, unknown> }) => this.rawQuery('RightsTopic', { ...opts, orderBy: opts?.orderBy || { order: 'asc' } }),
    findUnique: (opts?: { where?: Record<string, unknown> }) => this.rawFindUnique('RightsTopic', opts?.where),
  };
  policeStation = {
    count: (opts?: { where?: Record<string, unknown> }) => this.rawCount('PoliceStation', opts?.where),
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number; select?: Record<string, boolean> }) => this.rawQuery('PoliceStation', { ...opts, orderBy: opts?.orderBy || { name: 'asc' } }),
  };
  emergencyScenario = {
    count: () => this.rawCount('EmergencyScenario'),
    findMany: () => this.rawQuery('EmergencyScenario', { orderBy: { title: 'asc' } }),
  };
  helpline = {
    findMany: (opts?: { orderBy?: Record<string, string> }) => this.rawQuery('Helpline', { ...opts, orderBy: opts?.orderBy || { number: 'asc' } }),
    count: () => this.rawCount('Helpline'),
  };
  judge = {
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) => this.rawQuery('Judge', { ...opts, orderBy: opts?.orderBy || { name: 'asc' } }),
    count: (opts?: { where?: Record<string, unknown> }) => this.rawCount('Judge', opts?.where),
  };
  sCJudgment = {
    count: (opts?: { where?: Record<string, unknown> }) => this.rawCount('SCJudgment', opts?.where),
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number; select?: Record<string, boolean> }) => this.rawQuery('SCJudgment', { ...opts, orderBy: opts?.orderBy || { year: 'desc' } }),
  };
  legalInfoArticle = {
    count: (opts?: { where?: Record<string, unknown> }) => this.rawCount('LegalInfoArticle', opts?.where),
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) => this.rawQuery('LegalInfoArticle', { ...opts, orderBy: opts?.orderBy || { title: 'asc' } }),
    findUnique: (opts?: { where?: Record<string, unknown> }) => this.rawFindUnique('LegalInfoArticle', opts?.where),
  };
  documentTemplate = {
    findMany: (opts?: { orderBy?: Record<string, string> }) => this.rawQuery('DocumentTemplate', { ...opts, orderBy: opts?.orderBy || { title: 'asc' } }),
  };
  bookmark = {
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) => this.rawQuery('Bookmark', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' } }),
    create: (opts?: { data?: Record<string, unknown> }) => opts?.data ? this.rawInsert('Bookmark', opts.data) : Promise.resolve({}),
    deleteMany: (opts?: { where?: Record<string, unknown> }) => opts?.where ? this.rawDelete('Bookmark', opts.where) : Promise.resolve(),
    upsert: (opts?: { where?: Record<string, unknown>; create?: Record<string, unknown>; update?: Record<string, unknown> }) => opts ? this.rawUpsert('Bookmark', opts) : Promise.resolve({}),
  };
  feedback = {
    create: (opts?: { data?: Record<string, unknown> }) => opts?.data ? this.rawInsert('Feedback', opts.data) : Promise.resolve({}),
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; include?: Record<string, boolean> }) => this.rawQuery('Feedback', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 50 }),
  };
  contentReport = {
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; include?: Record<string, boolean> }) => this.rawQuery('ContentReport', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 200 }),
  };
  auditLog = {
    create: (opts?: { data?: Record<string, unknown> }) => opts?.data ? this.rawInsert('AuditLog', opts.data) : Promise.resolve({}),
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number }) => this.rawQuery('AuditLog', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 50 }),
  };
  profile = {
    findUnique: (opts?: { where?: Record<string, unknown> }) => this.rawFindUnique('Profile', opts?.where),
    create: (opts?: { data?: Record<string, unknown> }) => opts?.data ? this.rawInsert('Profile', opts.data) : Promise.resolve({}),
    upsert: (opts?: { where?: Record<string, unknown>; create?: Record<string, unknown>; update?: Record<string, unknown> }) => opts ? this.rawUpsert('Profile', opts) : Promise.resolve({}),
  };
  user = {
    findUnique: (opts?: { where?: Record<string, unknown> }) => this.rawFindUnique('User', opts?.where),
    create: (opts?: { data?: Record<string, unknown> }) => opts?.data ? this.rawInsert('User', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Record<string, unknown>; data?: Record<string, unknown> }) => opts?.where && opts?.data ? this.rawUpdate('User', opts.where, opts.data) : Promise.resolve(),
    delete: (opts?: { where?: Record<string, unknown> }) => opts?.where ? this.rawDelete('User', opts.where) : Promise.resolve(),
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; include?: Record<string, boolean> }) => this.rawQuery('User', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' } }),
    upsert: (opts?: { where?: Record<string, unknown>; create?: Record<string, unknown>; update?: Record<string, unknown> }) => opts ? this.rawUpsert('User', opts) : Promise.resolve({}),
  };
  chatSession = {
    findFirst: (opts?: { where?: Record<string, unknown> }) => this.rawFindUnique('ChatSession', opts?.where),
    create: (opts?: { data?: Record<string, unknown> }) => opts?.data ? this.rawInsert('ChatSession', opts.data) : Promise.resolve({}),
    findMany: (opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; include?: Record<string, unknown> }) => this.rawQuery('ChatSession', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 30 }),
    deleteMany: (opts?: { where?: Record<string, unknown> }) => opts?.where ? this.rawDelete('ChatSession', opts.where) : Promise.resolve(),
  };
  chatMessage = {
    create: (opts?: { data?: Record<string, unknown> }) => opts?.data ? this.rawInsert('ChatMessage', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Record<string, unknown>; data?: Record<string, unknown> }) => opts?.where && opts?.data ? this.rawUpdate('ChatMessage', opts.where, opts.data) : Promise.resolve(),
  };
  contentReview = {
    create: (opts?: { data?: Record<string, unknown> }) => opts?.data ? this.rawInsert('ContentReview', opts.data) : Promise.resolve({}),
  };
  groqKeyUsage = {
    upsert: (opts?: { where?: Record<string, unknown>; create?: Record<string, unknown>; update?: Record<string, unknown> }) => opts ? this.rawUpsert('GroqKeyUsage', opts) : Promise.resolve({}),
    findMany: (opts?: { where?: Record<string, unknown> }) => this.rawQuery('GroqKeyUsage', opts),
  };
}

function createDb(): DbLike {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    // PRODUCTION: Raw libSQL client to Turso (bypasses Prisma adapter bug)
    return new LibSqlDb(tursoUrl, tursoToken);
  }

  // DEVELOPMENT: Prisma with local SQLite
  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : [],
  }) as unknown as DbLike;
}

const globalForDb = globalThis as unknown as { db: DbLike | undefined }

export const db = globalForDb.db ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForDb.db = db
