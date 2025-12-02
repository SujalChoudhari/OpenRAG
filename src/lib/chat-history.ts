import fs from 'fs';
import path from 'path';
import { Message } from '../app/types';
import { CONFIG } from './config';

const SESSIONS_DIR = path.join(CONFIG.DATA_DIR, 'sessions');

// Ensure directories exist
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    messages: Message[];
}

export function createSession(id: string, title: string = 'New Chat'): ChatSession {
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
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
        console.error(`Error saving session ${session.id}:`, error);
    }
}

export function getAllSessions(): ChatSession[] {
    try {
        if (!fs.existsSync(SESSIONS_DIR)) return [];
        const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
        return files.map(file => {
            try {
                const data = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');
                return JSON.parse(data);
            } catch (e) {
                return null;
            }
        }).filter((s): s is ChatSession => s !== null)
            .sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
        console.error('Error getting all sessions:', error);
        return [];
    }
}

export function deleteSession(id: string): void {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}
