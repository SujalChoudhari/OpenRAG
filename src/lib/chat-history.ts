import fs from 'fs';
import path from 'path';
import { Message } from '../app/types';
import { CONFIG } from './config';

// Ensure directories exist
if (!fs.existsSync(CONFIG.DATA_DIR)) {
    fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
}

if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
    fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
}

// Generate a new unique file for each session
// Note: This logic creates a new file every time the module is loaded (server restart/cold start).
// Ideally this should be session-based, but keeping original behavior for now.
const timeStamp = `_${new Date().getFullYear()}_${new Date().getDate()}_${new Date().getMonth()}_${new Date().getHours()}_${new Date().getMinutes()}`;
const sessionFileName = `History${timeStamp}.md`;
const CHAT_HISTORY_FILE = path.join(CONFIG.DATA_DIR, sessionFileName);

// Create the session file if it doesn't exist
if (!fs.existsSync(CHAT_HISTORY_FILE)) {
    fs.writeFileSync(CHAT_HISTORY_FILE, '');
}

export async function storeMessage(message: Message, resetFile = false): Promise<void> {
    const formattedMessage = `${message.role.toUpperCase()}: ${JSON.stringify(message.content)}\n\n`;

    try {
        if (resetFile) {
            fs.writeFileSync(CHAT_HISTORY_FILE, formattedMessage);
        } else {
            fs.appendFileSync(CHAT_HISTORY_FILE, formattedMessage);
        }
    } catch (error) {
        console.error('Error storing message:', error);
    }
}

export async function clearMessages(): Promise<void> {
    try {
        fs.writeFileSync(CHAT_HISTORY_FILE, '');
    } catch (error) {
        console.error('Error clearing messages:', error);
    }
}

export function getHistoryFiles(): string[] {
    try {
        if (!fs.existsSync(CONFIG.DATA_DIR)) return [];
        return fs.readdirSync(CONFIG.DATA_DIR)
            .filter(file => file.startsWith('History') && file.endsWith('.md'))
            .sort((a, b) => {
                return fs.statSync(path.join(CONFIG.DATA_DIR, b)).mtime.getTime() -
                    fs.statSync(path.join(CONFIG.DATA_DIR, a)).mtime.getTime();
            });
    } catch (error) {
        console.error('Error getting history files:', error);
        return [];
    }
}

export function getHistoryContent(fileName: string): string {
    try {
        const filePath = path.join(CONFIG.DATA_DIR, fileName);
        if (!fs.existsSync(filePath)) return '';
        return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        console.error('Error reading history file:', error);
        return '';
    }
}
