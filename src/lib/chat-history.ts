import fs from 'fs';
import path from 'path';
import type { Message, ChatSession } from '@/app/types';
import { CONFIG } from './config';

// Re-export types for convenience
export type { ChatSession, Message } from '@/app/types';

const SESSIONS_DIR = path.join(CONFIG.DATA_DIR, 'sessions');

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
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading session ${id}:`, error);
        return null;
    }
}

export function saveSession(session: ChatSession): void {
    ensureSessionsDir();
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
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
