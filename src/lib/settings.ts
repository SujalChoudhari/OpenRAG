import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { CONFIG } from './config';
import type { Settings } from '@/app/types';

// Re-export for convenience
export type { Settings } from '@/app/types';

// Zod schema for validation
const SettingsSchema = z.object({
    ollamaHost: z.string().url().or(z.string().regex(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/)),
    embeddingModel: z.string().min(1),
    chatModel: z.string().min(1),
    summarizationModel: z.string().min(1),
    summaryTemperature: z.number().min(0).max(2),
    maxSummaryLength: z.number().int().positive(),
    retrievalCollectionCount: z.number().int().positive(),
    retrievalDocumentCount: z.number().int().positive(),
    retrievalChunkCount: z.number().int().positive(),
    systemPrompt: z.string(),
    vaultPath: z.string(),
});

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
    vaultPath: 'F:\\Workspace\\ObsidianVault\\Sujal',
};

export function getSettings(): Settings {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            saveSettings(DEFAULT_SETTINGS);
            return DEFAULT_SETTINGS;
        }
        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        // Merge with defaults to ensure all fields exist
        return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (error) {
        console.error('Error reading settings:', error);
        return DEFAULT_SETTINGS;
    }
}

export function getDefaultSettings(): Settings {
    return { ...DEFAULT_SETTINGS };
}

export interface SaveSettingsResult {
    success: boolean;
    error?: string;
}

export function saveSettings(settings: Settings): SaveSettingsResult {
    try {
        // Validate settings before saving
        const validation = SettingsSchema.safeParse(settings);
        if (!validation.success) {
            const errorMessage = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            console.error('Settings validation failed:', errorMessage);
            return { success: false, error: errorMessage };
        }

        if (!fs.existsSync(CONFIG.DATA_DIR)) {
            fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error saving settings';
        console.error('Error saving settings:', errorMessage);
        return { success: false, error: errorMessage };
    }
}

export function validateSettings(settings: unknown): settings is Settings {
    return SettingsSchema.safeParse(settings).success;
}
