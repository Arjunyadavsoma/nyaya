import { PrismaClient } from '@prisma/client'
import { createClient, type Client, type InValue } from '@libsql/client'

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

// Shared query-option shapes (Stage 0 G6: widened so all real call sites
// type-check — the previous narrow types forced `unknown` rows and rejected
// legitimate `select`/`count`/`findFirst` combinations, which is why the old
// build had ignoreBuildErrors: true).
type Where = Record<string, unknown>;
type OrderBy = Record<string, string>;
type Select = Record<string, boolean>;
type Data = Record<string, unknown>;

interface QueryOpts {
  where?: Where;
  orderBy?: OrderBy;
  take?: number;
  skip?: number;
  select?: Select;
  include?: Record<string, unknown>;
}

/**
 * Row-returning methods are typed `any` BY DESIGN at this boundary:
 * the production libsql shim builds SQL at runtime and returns dynamic
 * rows, while the dev-mode PrismaClient returns fully typed rows. Typed
 * generics here would require a full Prisma-type mirror; instead, call
 * sites keep Prisma's types in dev and treat rows as plain objects in
 * prod. Runtime validation (Zod at API boundaries) is the actual safety
 * net — see docs/SECURITY_AND_PRIVACY.md §4.2.
 */
interface FindMany {
  findMany: (opts?: QueryOpts) => Promise<any[]>;
}
interface Countable {
  count: (opts?: { where?: Where }) => Promise<number>;
}
interface FindUnique {
  findUnique: (opts?: { where?: Where; select?: Select }) => Promise<any>;
}
interface Crud {
  create?: (opts?: { data?: Data }) => Promise<any>;
  update?: (opts?: { where?: Where; data?: Data }) => Promise<any>;
  delete?: (opts?: { where?: Where }) => Promise<any>;
  upsert?: (opts?: { where?: Where; create?: Data; update?: Data }) => Promise<any>;
  deleteMany?: (opts?: { where?: Where }) => Promise<any>;
  updateMany?: (opts?: { where?: Where; data?: Data }) => Promise<any>;
  findFirst?: (opts?: QueryOpts) => Promise<any>;
}

// Minimal type that covers what the app uses
interface DbLike {
  // Models used by the app
  rightsArticle: FindMany & Countable & FindUnique & Crud;
  rightsTopic: FindMany & FindUnique;
  policeStation: FindMany & Countable & Crud & FindUnique;
  emergencyScenario: FindMany & Countable;
  helpline: FindMany & Countable;
  judge: FindMany & Countable & FindUnique & Crud;
  sCJudgment: FindMany & Countable;
  legalInfoArticle: FindMany & Countable & FindUnique & Crud;
  documentTemplate: FindMany & Countable;
  bookmark: FindMany & Crud & { groupBy?: (opts: Record<string, unknown>) => Promise<any[]> };
  feedback: FindMany & Crud;
  contentReport: FindMany & FindUnique & Crud & Countable;
  auditLog: FindMany & Crud;
  profile: FindUnique & Crud;
  user: FindUnique & Crud & FindMany & Countable;
  chatSession: FindMany & Crud;
  chatMessage: Crud;
  session: FindUnique & Crud & Countable & FindMany;
  rateLimitHit: Crud & FindUnique & FindMany;
  researchReport: FindMany & FindUnique & Crud & Countable;
  userDocument: FindMany & FindUnique & Crud & Countable;
  documentAnalysis: FindMany & FindUnique & Crud;
  documentVersion: FindMany & FindUnique & Crud;
  documentQa: FindMany & FindUnique & Crud;
  userDraft: FindMany & FindUnique & Crud;
  draftVersion: FindMany & FindUnique & Crud;
  legalSource: FindMany & FindUnique & Crud;
  legalDocument: FindMany & FindUnique & Crud;
  legalChunk: FindMany & FindUnique & Crud;
  knowledgeAmendment: FindMany & FindUnique & Crud;
  ingestionRun: FindMany & FindUnique & Crud;
  legalAidBody: FindMany & FindUnique & Crud & Countable;
  matter: FindMany & FindUnique & Crud & Countable;
  matterEvent: FindMany & FindUnique & Crud;
  matterTask: FindMany & FindUnique & Crud;
  contentReview: Crud;
  groqKeyUsage: FindMany & Crud;
  appSetting: Countable & FindUnique & Crud;
}

/** Tables whose primary key is not an `id` column: never auto-generate `id` on insert. */
const TABLES_WITHOUT_ID_PK = new Set(["Profile", "AppSetting"]);

/** Tables with a Prisma @updatedAt column (NOT NULL, no DB default): the shim fills it on write. */
const TABLES_WITH_UPDATED_AT = new Set([
  "AppSetting",
  "ChatSession",
  "DocumentTemplate",
  "EmergencyScenario",
  "GroqKeyUsage",
  "Judge",
  "LegalAidBody",
  "LegalDocument",
  "LegalInfoArticle",
  "Matter",
  "PoliceStation",
  "Profile",
  "RightsArticle",
  "User",
  "UserDocument",
  "UserDraft",
]);

/** Encode a JS value as a libsql argument: Date objects become ISO strings. */
function toInValue(v: unknown): InValue {
  if (v instanceof Date) return v.toISOString();
  return v as InValue;
}

class LibSqlDb implements DbLike {
  private client: Client;

  constructor(url: string, token: string) {
    this.client = createClient({ url, authToken: token });
  }

  /** Generate a CUID-like ID (replaces Prisma's @default(cuid())) */
  private genId(): string {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /** Identifier allowlist: SQL identifiers (table/column names) are never
   *  user-controlled, but defense-in-depth requires rejecting anything that
   *  is not a plain Prisma-style identifier (letters, digits, underscore).
   *  Stage 0 fix for audit G8 (rawQuery orderBy/where-key interpolation). */
  private assertIdentifier(name: string): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`[db] rejected unsafe SQL identifier: ${name.slice(0, 40)}`);
    }
    return name;
  }

  /** Validate a sort direction — only ASC/DESC ever reach SQL. */
  private assertDirection(dir: string): 'ASC' | 'DESC' {
    const d = String(dir || 'ASC').toUpperCase();
    if (d !== 'ASC' && d !== 'DESC') throw new Error(`[db] rejected unsafe sort direction: ${dir}`);
    return d;
  }

  private buildWhere(where?: Record<string, unknown>): { sql: string; args: InValue[] } {
    if (!where || typeof where !== 'object') return { sql: '', args: [] };
    const conditions: string[] = [];
    const args: InValue[] = [];
    for (const [key, val] of Object.entries(where)) {
      if (val === null || val === undefined) continue;
      const col = this.assertIdentifier(key);
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
        if ('contains' in v) { conditions.push(`"${col}" LIKE ?`); args.push(String(v.contains)); }
        else if ('equals' in v) { conditions.push(`"${col}" = ?`); args.push(toInValue(v.equals)); }
      } else {
        conditions.push(`"${col}" = ?`); args.push(toInValue(val));
      }
    }
    return { sql: conditions.join(' AND '), args };
  }

  private async rawQuery(table: string, opts?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number; include?: Record<string, unknown> }): Promise<Record<string, unknown>[]> {
    const tbl = this.assertIdentifier(table);
    let sql = `SELECT * FROM "${tbl}"`;
    const w = this.buildWhere(opts?.where);
    if (w.sql) sql += ` WHERE ${w.sql}`;
    if (opts?.orderBy) {
      const [[col, dir]] = Object.entries(opts.orderBy);
      sql += ` ORDER BY "${this.assertIdentifier(col)}" ${this.assertDirection(dir)}`;
    } else {
      sql += ` ORDER BY "createdAt" DESC`;
    }
    if (opts?.take) { sql += ` LIMIT ${Math.max(0, Math.floor(opts.take))}`; if (opts?.skip) sql += ` OFFSET ${Math.max(0, Math.floor(opts.skip))}`; }
    const r = await this.client.execute({ sql, args: w.args });
    return r.rows.map(row => {
      const obj: Record<string, unknown> = {};
      for (const col of r.columns) obj[col] = (row as Record<string, unknown>)[col];
      return obj;
    });
  }

  private async rawCount(table: string, where?: Record<string, unknown>): Promise<number> {
    const tbl = this.assertIdentifier(table);
    let sql = `SELECT COUNT(*) as n FROM "${tbl}"`;
    const w = this.buildWhere(where);
    if (w.sql) sql += ` WHERE ${w.sql}`;
    const r = await this.client.execute({ sql, args: w.args });
    return Number(r.rows[0]?.n ?? 0);
  }

  private async rawInsert(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Auto-generate id if not provided (Prisma's @default(cuid()) replacement),
// except tables whose primary key is not `id` (Profile, AppSetting).
    if (!data.id && !TABLES_WITHOUT_ID_PK.has(table)) {
      data = { id: this.genId(), ...data };
    }
    // Prisma @updatedAt columns are NOT NULL without a DB default: fill on insert.
    if (TABLES_WITH_UPDATED_AT.has(table) && data.updatedAt === undefined) {
      data = { ...data, updatedAt: new Date().toISOString() };
    }
    const tbl = this.assertIdentifier(table);
    const cols = Object.keys(data).map(c => this.assertIdentifier(c));
    const vals = Object.values(data).map(toInValue);
    const placeholders = cols.map(() => '?').join(',');
    await this.client.execute({ sql: `INSERT INTO "${tbl}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`, args: vals });
    return data;
  }

  private async rawUpdate(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
    const tbl = this.assertIdentifier(table);
    // Mirror Prisma @updatedAt: refresh on every update.
    if (TABLES_WITH_UPDATED_AT.has(table) && data.updatedAt === undefined) {
      data = { ...data, updatedAt: new Date().toISOString() };
    }
    const setCols = Object.keys(data).map(c => `"${this.assertIdentifier(c)}"=?`).join(',');
    const args: InValue[] = Object.values(data).map(toInValue);
    const w = this.buildWhere(where);
    if (w.sql) { args.push(...w.args); await this.client.execute({ sql: `UPDATE "${tbl}" SET ${setCols} WHERE ${w.sql}`, args }); }
    else { throw new Error('[db] UPDATE without WHERE is not allowed'); }
  }

  private async rawDelete(table: string, where: Record<string, unknown>): Promise<void> {
    const tbl = this.assertIdentifier(table);
    const w = this.buildWhere(where);
    if (w.sql) await this.client.execute({ sql: `DELETE FROM "${tbl}" WHERE ${w.sql}`, args: w.args });
    else throw new Error('[db] DELETE without WHERE is not allowed');
  }

  private async rawUpsert(table: string, opts: { where?: Record<string, unknown>; create?: Record<string, unknown>; update?: Record<string, unknown> }): Promise<Record<string, unknown>> {
    // Try to find existing
    const w = this.buildWhere(opts.where);
    if (w.sql) {
      const existing = await this.client.execute({ sql: `SELECT * FROM "${this.assertIdentifier(table)}" WHERE ${w.sql} LIMIT 1`, args: w.args });
      if (existing.rows.length > 0) {
        if (opts.update && opts.where) { await this.rawUpdate(table, opts.where, opts.update); }
        const obj: Record<string, unknown> = {};
        for (const col of existing.columns) obj[col] = (existing.rows[0] as Record<string, unknown>)[col];
        return obj;
      }
    }
    // Insert new
    return this.rawInsert(table, (opts.create || opts.update || {}) as Record<string, unknown>);
  }

  /** UPDATE affecting multiple rows (revocations, migrations). */
  private async rawUpdateMany(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
    const tbl = this.assertIdentifier(table);
    // Mirror Prisma @updatedAt: refresh on every update.
    if (TABLES_WITH_UPDATED_AT.has(table) && data.updatedAt === undefined) {
      data = { ...data, updatedAt: new Date().toISOString() };
    }
    const setCols = Object.keys(data).map(c => `"${this.assertIdentifier(c)}"=?`).join(',');
    const args: InValue[] = Object.values(data).map(toInValue);
    const w = this.buildWhere(where);
    if (!w.sql) throw new Error('[db] updateMany without WHERE is not allowed');
    args.push(...w.args);
    await this.client.execute({ sql: `UPDATE "${tbl}" SET ${setCols} WHERE ${w.sql}`, args });
  }

  private async rawFindUnique(table: string, where?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (!where) return null;
    const w = this.buildWhere(where);
    if (!w.sql) return null;
    const r = await this.client.execute({ sql: `SELECT * FROM "${this.assertIdentifier(table)}" WHERE ${w.sql} LIMIT 1`, args: w.args });
    if (!r.rows.length) return null;
    const obj: Record<string, unknown> = {};
    for (const col of r.columns) obj[col] = (r.rows[0] as Record<string, unknown>)[col];
    return obj;
  }

  // Model accessors (signatures widened to the shared QueryOpts shapes)
  rightsArticle = {
    count: (opts?: { where?: Where }) => this.rawCount('RightsArticle', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('RightsArticle', opts),
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('RightsArticle', opts?.where),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('RightsArticle', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('RightsArticle', opts.where, opts.data) : Promise.resolve(),
  };
  rightsTopic = {
    findMany: (opts?: QueryOpts) => this.rawQuery('RightsTopic', { ...opts, orderBy: opts?.orderBy || { order: 'asc' } }),
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('RightsTopic', opts?.where),
  };
  policeStation = {
    count: (opts?: { where?: Where }) => this.rawCount('PoliceStation', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('PoliceStation', { ...opts, orderBy: opts?.orderBy || { name: 'asc' } }),
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('PoliceStation', opts?.where),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('PoliceStation', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('PoliceStation', opts.where, opts.data) : Promise.resolve(),
  };
  emergencyScenario = {
    count: (opts?: { where?: Where }) => this.rawCount('EmergencyScenario', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('EmergencyScenario', { ...opts, orderBy: opts?.orderBy || { title: 'asc' } }),
  };
  helpline = {
    findMany: (opts?: QueryOpts) => this.rawQuery('Helpline', { ...opts, orderBy: opts?.orderBy || { number: 'asc' } }),
    count: (opts?: { where?: Where }) => this.rawCount('Helpline', opts?.where),
  };
  judge = {
    findMany: (opts?: QueryOpts) => this.rawQuery('Judge', { ...opts, orderBy: opts?.orderBy || { name: 'asc' } }),
    count: (opts?: { where?: Where }) => this.rawCount('Judge', opts?.where),
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('Judge', opts?.where),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('Judge', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('Judge', opts.where, opts.data) : Promise.resolve(),
  };
  sCJudgment = {
    count: (opts?: { where?: Where }) => this.rawCount('SCJudgment', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('SCJudgment', { ...opts, orderBy: opts?.orderBy || { year: 'desc' } }),
  };
  legalInfoArticle = {
    count: (opts?: { where?: Where }) => this.rawCount('LegalInfoArticle', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('LegalInfoArticle', { ...opts, orderBy: opts?.orderBy || { title: 'asc' } }),
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('LegalInfoArticle', opts?.where),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('LegalInfoArticle', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('LegalInfoArticle', opts.where, opts.data) : Promise.resolve(),
  };
  documentTemplate = {
    findMany: (opts?: QueryOpts) => this.rawQuery('DocumentTemplate', { ...opts, orderBy: opts?.orderBy || { title: 'asc' } }),
    count: (opts?: { where?: Where }) => this.rawCount('DocumentTemplate', opts?.where),
  };
  bookmark = {
    findMany: (opts?: QueryOpts) => this.rawQuery('Bookmark', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' } }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('Bookmark', opts.data) : Promise.resolve({}),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('Bookmark', opts.where) : Promise.resolve(),
    upsert: (opts?: { where?: Where; create?: Data; update?: Data }) => opts ? this.rawUpsert('Bookmark', opts) : Promise.resolve({}),
  };
  feedback = {
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('Feedback', opts.data) : Promise.resolve({}),
    findMany: (opts?: QueryOpts) => this.rawQuery('Feedback', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 50 }),
  };
  contentReport = {
    findMany: (opts?: QueryOpts) => this.rawQuery('ContentReport', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 200 }),
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('ContentReport', opts?.where),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('ContentReport', opts.where, opts.data) : Promise.resolve(),
    count: (opts?: { where?: Where }) => this.rawCount('ContentReport', opts?.where),
  };
  auditLog = {
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('AuditLog', opts.data) : Promise.resolve({}),
    findMany: (opts?: QueryOpts) => this.rawQuery('AuditLog', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 50 }),
  };
  profile = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('Profile', opts?.where),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('Profile', opts.data) : Promise.resolve({}),
    upsert: (opts?: { where?: Where; create?: Data; update?: Data }) => opts ? this.rawUpsert('Profile', opts) : Promise.resolve({}),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('Profile', opts.where) : Promise.resolve(),
  };
  user = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('User', opts?.where),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('User', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('User', opts.where, opts.data) : Promise.resolve(),
    delete: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('User', opts.where) : Promise.resolve(),
    findMany: (opts?: QueryOpts) => this.rawQuery('User', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' } }),
    upsert: (opts?: { where?: Where; create?: Data; update?: Data }) => opts ? this.rawUpsert('User', opts) : Promise.resolve({}),
    count: (opts?: { where?: Where }) => this.rawCount('User', opts?.where),
  };
  chatSession = {
    findFirst: (opts?: QueryOpts) => this.rawFindUnique('ChatSession', opts?.where),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('ChatSession', opts.data) : Promise.resolve({}),
    findMany: (opts?: QueryOpts) => this.rawQuery('ChatSession', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 30 }),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('ChatSession', opts.where) : Promise.resolve(),
  };
  chatMessage = {
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('ChatMessage', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('ChatMessage', opts.where, opts.data) : Promise.resolve(),
  };
  session = {
    findMany: (opts?: QueryOpts) => this.rawQuery('Session', { ...opts, take: opts?.take ?? 100 }),
    _rest: undefined,
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('Session', opts?.where),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('Session', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('Session', opts.where, opts.data) : Promise.resolve(),
    updateMany: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdateMany('Session', opts.where, opts.data) : Promise.resolve(),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('Session', opts.where) : Promise.resolve(),
    count: (opts?: { where?: Where }) => this.rawCount('Session', opts?.where),
  };
  rateLimitHit = {
    findMany: (opts?: QueryOpts) => this.rawQuery('RateLimitHit', { ...opts, take: opts?.take ?? 200 }),
    upsert: (opts?: { where?: Where; create?: Data; update?: Data }) => opts ? this.rawUpsert('RateLimitHit', opts) : Promise.resolve({}),
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('RateLimitHit', opts?.where),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('RateLimitHit', opts.where) : Promise.resolve(),
  };
  contentReview = {
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('ContentReview', opts.data) : Promise.resolve({}),
  };
  researchReport = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('ResearchReport', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('ResearchReport', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 20 }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('ResearchReport', opts.data) : Promise.resolve({}),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('ResearchReport', opts.where) : Promise.resolve(),
    count: (opts?: { where?: Where }) => this.rawCount('ResearchReport', opts?.where),
  };
  userDocument = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('UserDocument', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('UserDocument', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 100 }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('UserDocument', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('UserDocument', opts.where, opts.data) : Promise.resolve(),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('UserDocument', opts.where) : Promise.resolve(),
    count: (opts?: { where?: Where }) => this.rawCount('UserDocument', opts?.where),
  };
  documentAnalysis = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('DocumentAnalysis', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('DocumentAnalysis', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 10 }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('DocumentAnalysis', opts.data) : Promise.resolve({}),
  };
  documentVersion = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('DocumentVersion', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('DocumentVersion', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' } }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('DocumentVersion', opts.data) : Promise.resolve({}),
  };
  documentQa = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('DocumentQa', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('DocumentQa', { ...opts, orderBy: opts?.orderBy || { createdAt: 'desc' }, take: opts?.take || 20 }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('DocumentQa', opts.data) : Promise.resolve({}),
  };
  userDraft = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('UserDraft', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('UserDraft', { ...opts, orderBy: opts?.orderBy || { updatedAt: 'desc' }, take: opts?.take || 100 }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('UserDraft', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('UserDraft', opts.where, opts.data) : Promise.resolve(),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('UserDraft', opts.where) : Promise.resolve(),
  };
  draftVersion = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('DraftVersion', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('DraftVersion', { ...opts, orderBy: opts?.orderBy || { createdAt: 'asc' }, take: opts?.take || 50 }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('DraftVersion', opts.data) : Promise.resolve({}),
  };
  legalSource = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('LegalSource', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('LegalSource', opts),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('LegalSource', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('LegalSource', opts.where, opts.data) : Promise.resolve(),
  };
  legalDocument = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('LegalDocument', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('LegalDocument', { ...opts, orderBy: opts?.orderBy || { updatedAt: 'desc' } }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('LegalDocument', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('LegalDocument', opts.where, opts.data) : Promise.resolve({}),
  };
  legalChunk = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('LegalChunk', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('LegalChunk', opts),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('LegalChunk', opts.data) : Promise.resolve({}),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('LegalChunk', opts.where) : Promise.resolve({}),
  };
  knowledgeAmendment = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('KnowledgeAmendment', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('KnowledgeAmendment', { ...opts, orderBy: opts?.orderBy || { amendmentDate: 'desc' } }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('KnowledgeAmendment', opts.data) : Promise.resolve({}),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('KnowledgeAmendment', opts.where) : Promise.resolve(),
  };
  ingestionRun = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('IngestionRun', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('IngestionRun', { ...opts, orderBy: opts?.orderBy || { startedAt: 'desc' }, take: opts?.take || 50 }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('IngestionRun', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('IngestionRun', opts.where, opts.data) : Promise.resolve(),
  };
  matter = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('Matter', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('Matter', { ...opts, orderBy: opts?.orderBy || { updatedAt: 'desc' }, take: opts?.take || 100 }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('Matter', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('Matter', opts.where, opts.data) : Promise.resolve(),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('Matter', opts.where) : Promise.resolve(),
    count: (opts?: { where?: Where }) => this.rawCount('Matter', opts?.where),
  };
  matterEvent = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('MatterEvent', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('MatterEvent', { ...opts, orderBy: opts?.orderBy || { eventDate: 'desc' }, take: opts?.take || 200 }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('MatterEvent', opts.data) : Promise.resolve({}),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('MatterEvent', opts.where) : Promise.resolve(),
  };
  matterTask = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('MatterTask', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('MatterTask', { ...opts, orderBy: opts?.orderBy || { dueDate: 'asc' }, take: opts?.take || 200 }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('MatterTask', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('MatterTask', opts.where, opts.data) : Promise.resolve(),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('MatterTask', opts.where) : Promise.resolve(),
  };
  legalAidBody = {
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('LegalAidBody', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('LegalAidBody', { ...opts, orderBy: opts?.orderBy || { name: 'asc' } }),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('LegalAidBody', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('LegalAidBody', opts.where, opts.data) : Promise.resolve({}),
    deleteMany: (opts?: { where?: Where }) => opts?.where ? this.rawDelete('LegalAidBody', opts.where) : Promise.resolve(),
    count: (opts?: { where?: Where }) => this.rawCount('LegalAidBody', opts?.where),
  };
  appSetting = {
    count: (opts?: { where?: Where }) => this.rawCount('AppSetting', opts?.where),
    findUnique: (opts?: { where?: Where }) => this.rawFindUnique('AppSetting', opts?.where),
    findMany: (opts?: QueryOpts) => this.rawQuery('AppSetting', opts),
    create: (opts?: { data?: Data }) => opts?.data ? this.rawInsert('AppSetting', opts.data) : Promise.resolve({}),
    update: (opts?: { where?: Where; data?: Data }) => opts?.where && opts?.data ? this.rawUpdate('AppSetting', opts.where, opts.data) : Promise.resolve(),
    upsert: (opts?: { where?: Where; create?: Data; update?: Data }) => opts ? this.rawUpsert('AppSetting', opts) : Promise.resolve({}),
  };
  groqKeyUsage = {
    upsert: (opts?: { where?: Where; create?: Data; update?: Data }) => opts ? this.rawUpsert('GroqKeyUsage', opts) : Promise.resolve({}),
    findMany: (opts?: QueryOpts) => this.rawQuery('GroqKeyUsage', opts),
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
