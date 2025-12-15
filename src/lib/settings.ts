import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { CONFIG } from './config';
import type { Settings } from '@/app/types';

// Re-export for convenience
export type { Settings } from '@/app/types';

// Current settings version for migration support
const SETTINGS_VERSION = 1;

// Zod schema for validation with improved URL handling
const SettingsSchema = z.object({
    ollamaHost: z.string()
        .refine(val => {
            try {
                // Accept URLs like http://localhost:11434 or http://127.0.0.1:11434
                if (val.startsWith('http://') || val.startsWith('https://')) {
                    new URL(val);
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        }, { message: 'Invalid Ollama URL. Must start with http:// or https://' }),
    embeddingModel: z.string().min(1, 'Embedding model is required'),
    chatModel: z.string().min(1, 'Chat model is required'),
    retrievalDocumentCount: z.number().int().positive().max(50, 'Max 50 documents'),
    retrievalChunkCount: z.number().int().positive().max(50, 'Max 50 chunks'),
    vaultPath: z.string(),
    onboardingCompleted: z.boolean(),
    // New: version tracking for migrations
    version: z.number().optional(),
});

const SETTINGS_FILE = path.join(CONFIG.DATA_DIR, 'settings.json');
const SETTINGS_BACKUP = path.join(CONFIG.DATA_DIR, 'settings.backup.json');

const DEFAULT_SETTINGS: Settings = {
    ollamaHost: CONFIG.OLLAMA_HOST,
    embeddingModel: CONFIG.OLLAMA_EMBEDDING_MODEL,
    chatModel: CONFIG.OLLAMA_CHAT_MODEL,
    retrievalDocumentCount: 5,
    retrievalChunkCount: 5,
    vaultPath: '',  // Configured during onboarding
    onboardingCompleted: false,
};

/**
 * Migrate settings from older versions
 * Add migration logic here when settings schema changes
 */
function migrateSettings(rawSettings: Record<string, unknown>): Record<string, unknown> & { version?: number } {
    const version = (rawSettings.version as number) || 0;
    const migrated = { ...rawSettings };

    // Version 0 -> 1: Add version field
    if (version < 1) {
        migrated.version = 1;
        console.log('[Settings] Migrated settings to version 1');
    }

    // Future migrations go here:
    // if (version < 2) { ... }

    return migrated;
}

/**
 * Atomically write settings to prevent corruption
 */
function atomicWriteSettings(settings: Settings): void {
    const tempFile = SETTINGS_FILE + '.tmp';

    try {
        // Backup current settings first
        if (fs.existsSync(SETTINGS_FILE)) {
            fs.copyFileSync(SETTINGS_FILE, SETTINGS_BACKUP);
        }

        // Write to temp file
        fs.writeFileSync(tempFile, JSON.stringify(settings, null, 2), 'utf-8');

        // Rename temp to final (atomic on most filesystems)
        fs.renameSync(tempFile, SETTINGS_FILE);
    } catch (error) {
        // Clean up temp file if it exists
        try {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        } catch {
            // Ignore cleanup errors
        }
        throw error;
    }
}

export function getSettings(): Settings {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            saveSettings(DEFAULT_SETTINGS);
            return DEFAULT_SETTINGS;
        }
        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        let parsed: Record<string, unknown>;

        try {
            parsed = JSON.parse(data);
        } catch (parseError) {
            // Try to recover from backup
            console.error('[Settings] Failed to parse settings, trying backup...');
            return tryRecoverFromBackup();
        }

        // Apply migrations if needed
        const migrated = migrateSettings(parsed);

        // Merge with defaults to ensure all fields exist
        const finalSettings = { ...DEFAULT_SETTINGS, ...migrated };

        // Save if migration occurred
        if (parsed.version !== migrated.version) {
            saveSettings(finalSettings);
        }

        return finalSettings;
    } catch (error) {
        console.error('[Settings] Error reading settings:', error);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Attempt to recover settings from backup file
 */
function tryRecoverFromBackup(): Settings {
    try {
        if (fs.existsSync(SETTINGS_BACKUP)) {
            const backupData = fs.readFileSync(SETTINGS_BACKUP, 'utf-8');
            const parsed = JSON.parse(backupData);
            console.log('[Settings] Recovered from backup successfully');

            // Restore the backup as main settings
            fs.copyFileSync(SETTINGS_BACKUP, SETTINGS_FILE);

            return { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch {
        console.error('[Settings] Failed to recover from backup');
    }
    return DEFAULT_SETTINGS;
}

export function getDefaultSettings(): Settings {
    return { ...DEFAULT_SETTINGS };
}

export interface SaveSettingsResult {
    success: boolean;
    error?: string;
    warnings?: string[];
}

export function saveSettings(settings: Settings): SaveSettingsResult {
    const warnings: string[] = [];

    try {
        // Add version if missing
        const settingsWithVersion = {
            ...settings,
            version: SETTINGS_VERSION
        };

        // Validate settings before saving
        const validation = SettingsSchema.safeParse(settingsWithVersion);
        if (!validation.success) {
            const errorMessage = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            console.error('[Settings] Validation failed:', errorMessage);
            return { success: false, error: errorMessage };
        }

        // Validate vault path exists (if specified)
        if (settings.vaultPath && settings.vaultPath.trim() !== '') {
            if (!fs.existsSync(settings.vaultPath)) {
                warnings.push(`Vault path does not exist: ${settings.vaultPath}`);
            }
        }

        if (!fs.existsSync(CONFIG.DATA_DIR)) {
            fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
        }

        // Use atomic write to prevent corruption
        atomicWriteSettings(settingsWithVersion as Settings);

        return { success: true, warnings: warnings.length > 0 ? warnings : undefined };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error saving settings';
        console.error('[Settings] Error saving:', errorMessage);
        return { success: false, error: errorMessage };
    }
}

export function validateSettings(settings: unknown): settings is Settings {
    return SettingsSchema.safeParse(settings).success;
}

/**
 * Validate an Ollama URL is syntactically correct
 * Does NOT check if the server is actually reachable
 */
export function validateOllamaUrl(url: string): { valid: boolean; error?: string } {
    try {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return { valid: false, error: 'URL must start with http:// or https://' };
        }
        new URL(url);
        return { valid: true };
    } catch {
        return { valid: false, error: 'Invalid URL format' };
    }
}

/**
 * Check if a file/directory path exists
 */
export function validatePath(pathToCheck: string): { valid: boolean; exists: boolean; isDirectory: boolean } {
    if (!pathToCheck || pathToCheck.trim() === '') {
        return { valid: false, exists: false, isDirectory: false };
    }

    try {
        const exists = fs.existsSync(pathToCheck);
        if (!exists) {
            return { valid: true, exists: false, isDirectory: false };
        }
        const stat = fs.statSync(pathToCheck);
        return { valid: true, exists: true, isDirectory: stat.isDirectory() };
    } catch {
        return { valid: false, exists: false, isDirectory: false };
    }
}

/**
 * Get settings file location for debugging
 */
export function getSettingsPath(): string {
    return SETTINGS_FILE;
}
