import fs from 'fs';
import path from 'path';
import { Message } from '../types';

const DATA_DIR = path.join(process.cwd(), '_data');

// Create the data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Generate a new unique file for each session
const timeStamp = `_${new Date().getFullYear()}_${new Date().getDate()}_${new Date().getMonth()}_${new Date().getHours()}_${new Date().getMinutes()}`;
const sessionFileName = `chat_history_${timeStamp}.md`;
const CHAT_HISTORY_FILE = path.join(DATA_DIR, sessionFileName);

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
