import fs from 'fs';
import path from 'path';
import type { Message, ChatSession } from '@/app/types';
import { CONFIG } from './config';

// Re-export types for convenience
export type { ChatSession, Message } from '@/app/types';

const SESSIONS_DIR = path.join(CONFIG.DATA_DIR, 'sessions');

// Session limits for memory management
const MAX_MESSAGES_PER_SESSION = 500;
const SESSION_MAX_AGE_DAYS = 30;

// Ensure directories exist
function ensureSessionsDir(): void {
    if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
}

// Initialize on module load
ensureSessionsDir();

export function createSession(id: string, title: string = 'New Chat'): ChatSession {
    ensureSessionsDir();
    const session: ChatSession = {
        id,
        title,
        createdAt: Date.now(),
        messages: []
    };
    saveSession(session);
    return session;
}

export function getSession(id: string): ChatSession | null {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const session = JSON.parse(data) as ChatSession;

        // Apply message limit when loading (trim oldest messages if exceeded)
        if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
            console.log(`[ChatHistory] Session ${id} exceeded ${MAX_MESSAGES_PER_SESSION} messages, trimming...`);
            session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
            // Save the trimmed session
            saveSession(session);
        }

        return session;
    } catch (error) {
        console.error(`Error reading session ${id}:`, error);
        // Attempt to recover from corrupted session
        return tryRecoverSession(id);
    }
}

/**
 * Attempt to recover a corrupted session by recreating it
 */
function tryRecoverSession(id: string): ChatSession | null {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    const backupPath = path.join(SESSIONS_DIR, `${id}.json.corrupted`);

    try {
        // Move corrupted file to backup
        if (fs.existsSync(filePath)) {
            fs.renameSync(filePath, backupPath);
            console.log(`[ChatHistory] Moved corrupted session to ${backupPath}`);
        }
        // Return null to create fresh session
        return null;
    } catch {
        return null;
    }
}

/**
 * Atomic write using temp file to prevent corruption
 */
function atomicWriteSync(filePath: string, data: string): void {
    const tempPath = `${filePath}.tmp`;
    try {
        // Write to temp file first
        fs.writeFileSync(tempPath, data, 'utf-8');
        // Rename temp to final (atomic on most filesystems)
        fs.renameSync(tempPath, filePath);
    } catch (error) {
        // Clean up temp file if it exists
        try {
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        } catch {
            // Ignore cleanup errors
        }
        throw error;
    }
}

export function saveSession(session: ChatSession): void {
    ensureSessionsDir();
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);

    try {
        // Enforce message limit before saving
        if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
            session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
        }

        // Use atomic write to prevent corruption
        atomicWriteSync(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
        console.error(`Error saving session ${session.id}:`, error);
    }
}

export function getAllSessions(): ChatSession[] {
    try {
        ensureSessionsDir();
        const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
        return files.map(file => {
            try {
                const data = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');
                return JSON.parse(data);
            } catch {
                return null;
            }
        }).filter((s): s is ChatSession => s !== null)
            .sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
        console.error('Error getting all sessions:', error);
        return [];
    }
}

export function deleteSession(id: string): boolean {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error deleting session ${id}:`, error);
        return false;
    }
}

export function clearAllSessions(): boolean {
    try {
        ensureSessionsDir();
        const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            fs.unlinkSync(path.join(SESSIONS_DIR, file));
        }
        return true;
    } catch (error) {
        console.error('Error clearing all sessions:', error);
        return false;
    }
}

/**
 * Clean up old sessions to free disk space
 * @returns Number of sessions deleted
 */
export function cleanupOldSessions(): { deleted: number; errors: number } {
    const result = { deleted: 0, errors: 0 };
    const maxAgeMs = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - maxAgeMs;

    try {
        ensureSessionsDir();
        const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));

        for (const file of files) {
            try {
                const filePath = path.join(SESSIONS_DIR, file);
                const data = fs.readFileSync(filePath, 'utf-8');
                const session = JSON.parse(data) as ChatSession;

                if (session.createdAt < cutoffTime) {
                    fs.unlinkSync(filePath);
                    result.deleted++;
                    console.log(`[ChatHistory] Cleaned up old session: ${session.id}`);
                }
            } catch {
                result.errors++;
            }
        }
    } catch (error) {
        console.error('Error during session cleanup:', error);
    }

    return result;
}

/**
 * Get session statistics for debugging/monitoring
 */
export function getSessionStats(): { totalSessions: number; totalMessages: number; oldestSession: number | null } {
    try {
        const sessions = getAllSessions();
        const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
        const oldestSession = sessions.length > 0
            ? Math.min(...sessions.map(s => s.createdAt))
            : null;

        return {
            totalSessions: sessions.length,
            totalMessages,
            oldestSession
        };
    } catch {
        return { totalSessions: 0, totalMessages: 0, oldestSession: null };
    }
}
