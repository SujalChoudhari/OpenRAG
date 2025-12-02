import fs from 'fs';
import path from 'path';
import { CONFIG } from './config';

export interface Settings {
    ollamaHost: string;
    embeddingModel: string;
    chatModel: string;
    summarizationModel: string;
    summaryTemperature: number;
    maxSummaryLength: number;
    retrievalCollectionCount: number;
    retrievalDocumentCount: number;
    retrievalChunkCount: number;
    systemPrompt: string;
}

const SETTINGS_FILE = path.join(CONFIG.DATA_DIR, 'settings.json');

const DEFAULT_SETTINGS: Settings = {
    ollamaHost: CONFIG.OLLAMA_HOST,
    embeddingModel: CONFIG.OLLAMA_EMBEDDING_MODEL,
    chatModel: CONFIG.OLLAMA_CHAT_MODEL,
    summarizationModel: CONFIG.OLLAMA_CHAT_MODEL,
    summaryTemperature: 0.3,
    maxSummaryLength: 100,
    retrievalCollectionCount: 3,
    retrievalDocumentCount: 5,
    retrievalChunkCount: 5,
    systemPrompt: '',
};

export function getSettings(): Settings {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            saveSettings(DEFAULT_SETTINGS);
            return DEFAULT_SETTINGS;
        }
        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch (error) {
        console.error('Error reading settings:', error);
        return DEFAULT_SETTINGS;
    }
}

export function saveSettings(settings: Settings): void {
    try {
        if (!fs.existsSync(CONFIG.DATA_DIR)) {
            fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}
