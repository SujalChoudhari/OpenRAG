import * as lancedb from '@lancedb/lancedb';
import { CONFIG } from './config';
import fs from 'fs';

// Default dimension - will be updated based on actual embedding model
let currentVectorDim: number | null = null;

let dbInstance: lancedb.Connection | null = null;
let connectPromise: Promise<lancedb.Connection> | null = null;

// Connection health tracking
let lastHealthCheck = 0;
let isHealthy = true;
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute

/**
 * Exponential backoff retry wrapper for transient failures
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Base delay in milliseconds (doubles each retry)
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 500
): Promise<T> {
    let lastError: Error | unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on certain errors
            const errorMsg = error instanceof Error ? error.message.toLowerCase() : '';
            if (errorMsg.includes('dimension') || errorMsg.includes('schema')) {
                throw error; // Schema errors won't be fixed by retry
            }

            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.warn(`[LanceDB] Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`, error);
                await new Promise(resolve => setTimeout(resolve, delay));

                // Reset connection on retry
                if (attempt > 0) {
                    dbInstance = null;
                    connectPromise = null;
                }
            }
        }
    }

    throw lastError;
}

/**
 * Get connection health status
 */
export function getHealthStatus(): { isHealthy: boolean; lastCheck: number } {
    return { isHealthy, lastCheck: lastHealthCheck };
}

export function setVectorDimension(dim: number) {
    currentVectorDim = dim;
}

export function getVectorDimension(): number {
    return currentVectorDim || 384; // Default fallback
}

export async function getLanceDb(): Promise<lancedb.Connection> {
    // Return existing instance if available and healthy
    if (dbInstance) {
        // Periodic health check
        const now = Date.now();
        if (now - lastHealthCheck > HEALTH_CHECK_INTERVAL) {
            lastHealthCheck = now;
            // Non-blocking health check
            checkHealthInternal().catch(() => {
                isHealthy = false;
                dbInstance = null;
                connectPromise = null;
            });
        }
        return dbInstance;
    }

    // If connection is already in progress, wait for it
    if (connectPromise) return connectPromise;

    // Start new connection with retry
    connectPromise = withRetry(async () => {
        if (!fs.existsSync(CONFIG.LANCEDB_URI)) {
            fs.mkdirSync(CONFIG.LANCEDB_URI, { recursive: true });
        }

        const instance = await lancedb.connect(CONFIG.LANCEDB_URI);
        dbInstance = instance;
        isHealthy = true;
        lastHealthCheck = Date.now();
        return instance;
    }, 3, 500).catch(error => {
        // Reset state on final failure
        connectPromise = null;
        isHealthy = false;
        throw error;
    });

    return connectPromise;
}

// Internal health check (non-exported, doesn't throw)
async function checkHealthInternal(): Promise<boolean> {
    try {
        if (!dbInstance) return false;
        await dbInstance.tableNames();
        isHealthy = true;
        return true;
    } catch {
        isHealthy = false;
        return false;
    }
}


export async function getTable(tableName: string = 'vectors', vectorDim?: number): Promise<lancedb.Table> {
    const db = await getLanceDb();
    const tableNames = await db.tableNames();
    const dim = vectorDim || getVectorDimension();

    if (!tableNames.includes(tableName)) {
        // Create table with schema-defining dummy row
        const dummyVector = Array(dim).fill(0.0);
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
        // Use parameterized query to prevent injection
        await table.delete('id = "init_placeholder"');
        return table;
    }

    return await db.openTable(tableName);
}

export async function resetTable(tableName: string = 'vectors'): Promise<void> {
    const db = await getLanceDb();
    const tableNames = await db.tableNames();
    if (tableNames.includes(tableName)) {
        await db.dropTable(tableName);
    }
    // Reset ALL cached state to force fresh recreation
    dbInstance = null;
    connectPromise = null;
    currentVectorDim = null; // CRITICAL: Reset dimension so next embedding sets it fresh
}

// Batch insert records for better performance
export async function batchInsert(tableName: string, records: Record<string, unknown>[]): Promise<void> {
    if (records.length === 0) return;

    const table = await getTable(tableName);
    await table.add(records);
}

// Safe delete with escaped values to prevent injection
function escapeForLanceDB(value: string): string {
    // Escape special characters
    return value.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
}

export async function safeDelete(tableName: string, field: string, value: string): Promise<void> {
    const table = await getTable(tableName);
    const escapedValue = escapeForLanceDB(value);
    await table.delete(`${field} = "${escapedValue}"`);
}

// Health check for the database connection
export async function checkHealth(): Promise<boolean> {
    try {
        const db = await getLanceDb();
        await db.tableNames();
        return true;
    } catch (error) {
        console.error('LanceDB health check failed:', error);
        return false;
    }
}

// Reconnect to database (useful after errors)
export async function reconnect(): Promise<void> {
    dbInstance = null;
    connectPromise = null;
    await getLanceDb();
}

// Check if table needs recreation due to dimension mismatch
export async function needsRecreation(tableName: string = 'vectors'): Promise<boolean> {
    try {
        const db = await getLanceDb();
        const tableNames = await db.tableNames();

        if (!tableNames.includes(tableName)) {
            return false; // Will be created fresh
        }

        // Try a sample query to check dimension
        const table = await db.openTable(tableName);
        const count = await table.countRows();

        if (count === 0) {
            return false; // Empty table, will work with any dimension
        }

        return false; // Assume OK, dimension check would require actual query
    } catch (error) {
        console.error('Error checking table recreation need:', error);
        return true; // Recreate on error
    }
}
