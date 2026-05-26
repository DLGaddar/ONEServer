"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.runMigrations = runMigrations;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const kysely_1 = require("kysely");
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const main_1 = __importDefault(require("electron-log/main"));
// Get the user data directory
const userDataPath = electron_1.app.getPath('userData');
const dbDir = path_1.default.resolve(userDataPath);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path_1.default.join(dbDir, 'oneserver.db');
main_1.default.info(`[Database] Initializing SQLite database at: ${dbPath}`);
const sqliteDb = new better_sqlite3_1.default(dbPath);
// Enable WAL mode for high performance and concurrent reads
sqliteDb.pragma('journal_mode = WAL');
exports.db = new kysely_1.Kysely({
    dialect: new kysely_1.SqliteDialect({
        database: sqliteDb,
    }),
});
async function runMigrations() {
    main_1.default.info('[Database] Running migrations...');
    try {
        await exports.db.schema
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
            await exports.db.schema.alterTable('servers').addColumn('password', 'text').execute();
            main_1.default.info('[Database] Alter migration: Added password column to servers.');
        }
        catch (e) {
            // Column already exists, safe to ignore
        }
        main_1.default.info('[Database] Migrations verified successfully.');
    }
    catch (error) {
        main_1.default.error('[Database] Migration failed:', error);
        throw error;
    }
}
