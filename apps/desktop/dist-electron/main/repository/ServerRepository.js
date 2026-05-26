"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerRepository = void 0;
const db_1 = require("../db");
const core_1 = require("@oneserver/core");
const crypto_1 = __importDefault(require("crypto"));
const main_1 = __importDefault(require("electron-log/main"));
class ServerRepository {
    async getAll() {
        main_1.default.info('[Repository] Fetching all servers...');
        try {
            const rows = await db_1.db
                .selectFrom('servers')
                .selectAll()
                .orderBy('createdAt', 'desc')
                .execute();
            return rows.map((row) => ({
                ...row,
                password: row.password === null ? undefined : row.password,
                keyPath: row.keyPath === null ? undefined : row.keyPath,
            }));
        }
        catch (error) {
            main_1.default.error('[Repository] Error fetching all servers:', error);
            throw error;
        }
    }
    async getById(id) {
        main_1.default.info(`[Repository] Fetching server by ID: ${id}`);
        try {
            const row = await db_1.db
                .selectFrom('servers')
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst();
            if (!row)
                return null;
            return {
                ...row,
                password: row.password === null ? undefined : row.password,
                keyPath: row.keyPath === null ? undefined : row.keyPath,
            };
        }
        catch (error) {
            main_1.default.error(`[Repository] Error fetching server ${id}:`, error);
            throw error;
        }
    }
    async add(input) {
        main_1.default.info(`[Repository] Adding new server: ${input.nickname}`);
        try {
            // Validate input using Zod schema from core
            const validated = core_1.createServerSchema.parse(input);
            const now = new Date().toISOString();
            const newServer = {
                id: crypto_1.default.randomUUID(),
                nickname: validated.nickname,
                ip: validated.ip,
                port: validated.port,
                username: validated.username,
                password: validated.password || undefined,
                keyPath: validated.keyPath || undefined,
                createdAt: now,
                updatedAt: now,
            };
            await db_1.db
                .insertInto('servers')
                .values({
                id: newServer.id,
                nickname: newServer.nickname,
                ip: newServer.ip,
                port: newServer.port,
                username: newServer.username,
                password: newServer.password || null,
                keyPath: newServer.keyPath || null,
                createdAt: newServer.createdAt,
                updatedAt: newServer.updatedAt,
            })
                .execute();
            main_1.default.info(`[Repository] Server added successfully with ID: ${newServer.id}`);
            return newServer;
        }
        catch (error) {
            main_1.default.error('[Repository] Error adding server:', error);
            throw error;
        }
    }
    async update(input) {
        main_1.default.info(`[Repository] Updating server ID: ${input.id}`);
        try {
            // Validate input using Zod schema from core
            const validated = core_1.updateServerSchema.parse(input);
            // Check if server exists
            const existing = await this.getById(validated.id);
            if (!existing) {
                throw new Error(`Server with ID ${validated.id} not found`);
            }
            const now = new Date().toISOString();
            // Prepare Kysely update fields (only set fields that are defined in input)
            const updateData = {
                updatedAt: now
            };
            if (validated.nickname !== undefined)
                updateData.nickname = validated.nickname;
            if (validated.ip !== undefined)
                updateData.ip = validated.ip;
            if (validated.port !== undefined)
                updateData.port = validated.port;
            if (validated.username !== undefined)
                updateData.username = validated.username;
            if (validated.password !== undefined)
                updateData.password = validated.password || null;
            if (validated.keyPath !== undefined)
                updateData.keyPath = validated.keyPath || null;
            await db_1.db
                .updateTable('servers')
                .set(updateData)
                .where('id', '=', validated.id)
                .execute();
            main_1.default.info(`[Repository] Server ${validated.id} updated successfully.`);
            const finalRecord = await this.getById(validated.id);
            if (!finalRecord) {
                throw new Error(`Failed to retrieve updated server ${validated.id}`);
            }
            return finalRecord;
        }
        catch (error) {
            main_1.default.error(`[Repository] Error updating server ${input.id}:`, error);
            throw error;
        }
    }
    async remove(id) {
        main_1.default.info(`[Repository] Deleting server ID: ${id}`);
        try {
            const result = await db_1.db
                .deleteFrom('servers')
                .where('id', '=', id)
                .executeTakeFirst();
            const numDeleted = result.numDeletedRows;
            const success = numDeleted > 0n;
            main_1.default.info(`[Repository] Server deletion result for ${id}: ${success}`);
            return success;
        }
        catch (error) {
            main_1.default.error(`[Repository] Error deleting server ${id}:`, error);
            throw error;
        }
    }
}
exports.ServerRepository = ServerRepository;
