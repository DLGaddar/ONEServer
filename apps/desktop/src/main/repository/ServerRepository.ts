import { db } from '../db';
import { Server, CreateServerInput, UpdateServerInput, createServerSchema, updateServerSchema } from '@oneserver/core';
import crypto from 'crypto';
import log from 'electron-log/main';

export class ServerRepository {
  
  async getAll(): Promise<Server[]> {
    log.info('[Repository] Fetching all servers...');
    try {
      const rows = await db
        .selectFrom('servers')
        .selectAll()
        .orderBy('createdAt', 'desc')
        .execute();
      
      return rows.map((row) => ({
        ...row,
        password: row.password === null ? undefined : row.password,
        keyPath: row.keyPath === null ? undefined : row.keyPath,
      }));
    } catch (error) {
      log.error('[Repository] Error fetching all servers:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Server | null> {
    log.info(`[Repository] Fetching server by ID: ${id}`);
    try {
      const row = await db
        .selectFrom('servers')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      
      if (!row) return null;
      
      return {
        ...row,
        password: row.password === null ? undefined : row.password,
        keyPath: row.keyPath === null ? undefined : row.keyPath,
      };
    } catch (error) {
      log.error(`[Repository] Error fetching server ${id}:`, error);
      throw error;
    }
  }

  async add(input: CreateServerInput): Promise<Server> {
    log.info(`[Repository] Adding new server: ${input.nickname}`);
    try {
      // Validate input using Zod schema from core
      const validated = createServerSchema.parse(input);
      
      const now = new Date().toISOString();
      const newServer: Server = {
        id: crypto.randomUUID(),
        nickname: validated.nickname,
        ip: validated.ip,
        port: validated.port,
        username: validated.username,
        password: validated.password || undefined,
        keyPath: validated.keyPath || undefined,
        createdAt: now,
        updatedAt: now,
      };

      await db
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

      log.info(`[Repository] Server added successfully with ID: ${newServer.id}`);
      return newServer;
    } catch (error) {
      log.error('[Repository] Error adding server:', error);
      throw error;
    }
  }

  async update(input: UpdateServerInput): Promise<Server> {
    log.info(`[Repository] Updating server ID: ${input.id}`);
    try {
      // Validate input using Zod schema from core
      const validated = updateServerSchema.parse(input);
      
      // Check if server exists
      const existing = await this.getById(validated.id);
      if (!existing) {
        throw new Error(`Server with ID ${validated.id} not found`);
      }

      const now = new Date().toISOString();
      
      // Prepare Kysely update fields (only set fields that are defined in input)
      const updateData: any = {
        updatedAt: now
      };
      
      if (validated.nickname !== undefined) updateData.nickname = validated.nickname;
      if (validated.ip !== undefined) updateData.ip = validated.ip;
      if (validated.port !== undefined) updateData.port = validated.port;
      if (validated.username !== undefined) updateData.username = validated.username;
      if (validated.password !== undefined) updateData.password = validated.password || null;
      if (validated.keyPath !== undefined) updateData.keyPath = validated.keyPath || null;

      await db
        .updateTable('servers')
        .set(updateData)
        .where('id', '=', validated.id)
        .execute();

      log.info(`[Repository] Server ${validated.id} updated successfully.`);
      
      const finalRecord = await this.getById(validated.id);
      if (!finalRecord) {
        throw new Error(`Failed to retrieve updated server ${validated.id}`);
      }
      return finalRecord;
    } catch (error) {
      log.error(`[Repository] Error updating server ${input.id}:`, error);
      throw error;
    }
  }

  async remove(id: string): Promise<boolean> {
    log.info(`[Repository] Deleting server ID: ${id}`);
    try {
      const result = await db
        .deleteFrom('servers')
        .where('id', '=', id)
        .executeTakeFirst();
      
      const numDeleted = result.numDeletedRows;
      const success = numDeleted > 0n;
      log.info(`[Repository] Server deletion result for ${id}: ${success}`);
      return success;
    } catch (error) {
      log.error(`[Repository] Error deleting server ${id}:`, error);
      throw error;
    }
  }
}
