import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { CONFIG } from './config';
import fs from 'fs';

class DatabaseClient {
    private static instance: Database | null = null;

    private constructor() { }

    public static async getInstance(): Promise<Database> {
        if (!DatabaseClient.instance) {
            // Ensure data directory exists
            if (!fs.existsSync(CONFIG.DATA_DIR)) {
                fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
            }

            DatabaseClient.instance = await open({
                filename: CONFIG.DB_PATH,
                driver: sqlite3.Database,
            });

            await DatabaseClient.initializeSchema(DatabaseClient.instance);
        }
        return DatabaseClient.instance;
    }

    private static async initializeSchema(db: Database) {
        await db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        embedding BLOB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        summary TEXT,
        embedding BLOB
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL,
        summary TEXT,
        embedding BLOB,
        original_text TEXT,
        FOREIGN KEY(collection_id) REFERENCES collections(id)
      );

      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        summary TEXT,
        embedding BLOB,
        original_text TEXT,
        FOREIGN KEY(document_id) REFERENCES documents(id)
      );
    `);
    }
}

export const getDb = DatabaseClient.getInstance;
