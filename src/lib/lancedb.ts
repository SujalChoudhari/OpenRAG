import * as lancedb from '@lancedb/lancedb';
import { CONFIG } from './config';
import fs from 'fs';

// Default dimension for all-MiniLM-L6-v2 (384)
const DEFAULT_VECTOR_DIM = 384;

let dbInstance: lancedb.Connection | null = null;

export async function getLanceDb() {
    if (dbInstance) return dbInstance;

    if (!fs.existsSync(CONFIG.LANCEDB_URI)) {
        fs.mkdirSync(CONFIG.LANCEDB_URI, { recursive: true });
    }

    dbInstance = await lancedb.connect(CONFIG.LANCEDB_URI);
    return dbInstance;
}

export async function getTable(tableName: string = 'vectors') {
    const db = await getLanceDb();
    const tableNames = await db.tableNames();

    if (!tableNames.includes(tableName)) {
        // We create the table with a dummy row to enforce schema, then delete it.
        // LanceDB requires data to infer schema if not provided explicitly, 
        // or we can strictly define it. For simplicity in this stack, we'll infer from a precise dummy.
        // However, standard practice with this lib is often just `createTable`.

        // Let's try to pass the schema definition if possible, or just the data.
        // We'll init with empty data structure if the lib supports it, 
        // otherwise we just wait for the first insertion to define the schema.
        // BUT, vector filtering requires a known schema.

        // Strategy: We will double check if we can create an empty table with schema.
        // Providing a single dummy record is the most robust way in the specific JS binding version usually.

        const dummyVector = Array(DEFAULT_VECTOR_DIM).fill(0.0);
        await db.createTable(tableName, [
            {
                id: 'init_placeholder',
                text: 'init',
                source: 'init',
                type: 'init',
                metadata: '{}',
                vector: dummyVector
            }
        ]);
        const table = await db.openTable(tableName);
        await table.delete('id = "init_placeholder"');
        return table;
    }

    return await db.openTable(tableName);
}

export async function resetTable(tableName: string = 'vectors') {
    const db = await getLanceDb();
    const tableNames = await db.tableNames();
    if (tableNames.includes(tableName)) {
        await db.dropTable(tableName);
    }
}
