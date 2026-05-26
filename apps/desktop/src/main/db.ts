import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log/main';
import { DatabaseSchema } from './db.schema';

// Get the user data directory
const userDataPath = app.getPath('userData');
const dbDir = path.resolve(userDataPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'oneserver.db');
log.info(`[Database] Initializing SQLite database at: ${dbPath}`);

const sqliteDb = new Database(dbPath);

// Enable WAL mode for high performance and concurrent reads
sqliteDb.pragma('journal_mode = WAL');

export const db = new Kysely<DatabaseSchema>({
  dialect: new SqliteDialect({
    database: sqliteDb,
  }),
});

export async function runMigrations(): Promise<void> {
  log.info('[Database] Running migrations...');
  try {
    await db.schema
      .createTable('servers')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('nickname', 'text', (col) => col.notNull())
      .addColumn('ip', 'text', (col) => col.notNull())
      .addColumn('port', 'integer', (col) => col.notNull())
      .addColumn('username', 'text', (col) => col.notNull())
      .addColumn('password', 'text')
      .addColumn('keyPath', 'text')
      .addColumn('createdAt', 'text', (col) => col.notNull())
      .addColumn('updatedAt', 'text', (col) => col.notNull())
      .execute();
      
    // Dynamically alter existing database if it doesn't have the password column
    try {
      await db.schema.alterTable('servers').addColumn('password', 'text').execute();
      log.info('[Database] Alter migration: Added password column to servers.');
    } catch (e) {
      // Column already exists, safe to ignore
    }
      
    log.info('[Database] Migrations verified successfully.');
  } catch (error) {
    log.error('[Database] Migration failed:', error);
    throw error;
  }
}
