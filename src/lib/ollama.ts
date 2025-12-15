import { Ollama } from 'ollama';
import { getSettings } from './settings';

// Cached instance and health status
let ollamaInstance: Ollama | null = null;
let lastHostUsed: string | null = null;

// Health check cache
let cachedHealth: OllamaHealthStatus | null = null;
let healthCheckTimestamp = 0;
const HEALTH_CACHE_TTL = 30000; // 30 seconds

export interface OllamaHealthStatus {
    connected: boolean;
    models: string[];
    error?: string;
    latencyMs?: number;
}

/**
 * Get or create Ollama client instance
 * Recreates client if host has changed
 */
export const getOllama = (): Ollama => {
    const settings = getSettings();

    // Recreate instance if host changed
    if (!ollamaInstance || lastHostUsed !== settings.ollamaHost) {
        ollamaInstance = new Ollama({
            host: settings.ollamaHost,
        });
        lastHostUsed = settings.ollamaHost;
        // Invalidate health cache when host changes
        cachedHealth = null;
    }

    return ollamaInstance;
};

/**
 * Check Ollama connection health with caching
 * Returns cached result if within TTL to avoid excessive API calls
 */
export async function checkOllamaHealth(forceRefresh = false): Promise<OllamaHealthStatus> {
    const now = Date.now();

    // Return cached result if valid and not forcing refresh
    if (!forceRefresh && cachedHealth && (now - healthCheckTimestamp < HEALTH_CACHE_TTL)) {
        return cachedHealth;
    }

    const startTime = now;

    try {
        const ollama = getOllama();
        const models = await ollama.list();

        cachedHealth = {
            connected: true,
            models: models.models.map(m => m.name),
            latencyMs: Date.now() - startTime
        };
        healthCheckTimestamp = Date.now();

        return cachedHealth;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        cachedHealth = {
            connected: false,
            models: [],
            error: errorMsg.includes('ECONNREFUSED')
                ? 'Cannot connect to Ollama. Is it running?'
                : errorMsg,
            latencyMs: Date.now() - startTime
        };
        healthCheckTimestamp = Date.now();

        return cachedHealth;
    }
}

/**
 * Validate that a specific model is available
 */
export async function validateModel(modelName: string): Promise<{
    valid: boolean;
    error?: string;
    suggestion?: string;
}> {
    try {
        const health = await checkOllamaHealth();

        if (!health.connected) {
            return {
                valid: false,
                error: health.error || 'Ollama not connected'
            };
        }

        // Check if model exists (normalize name comparison)
        const normalizedName = modelName.toLowerCase().trim();
        const modelExists = health.models.some(m =>
            m.toLowerCase().startsWith(normalizedName) ||
            normalizedName.startsWith(m.toLowerCase().split(':')[0])
        );

        if (!modelExists) {
            // Suggest similar models
            const suggestions = health.models
                .filter(m => m.toLowerCase().includes(normalizedName.split(':')[0]))
                .slice(0, 3);

            return {
                valid: false,
                error: `Model "${modelName}" not found`,
                suggestion: suggestions.length > 0
                    ? `Available similar models: ${suggestions.join(', ')}`
                    : `Run: ollama pull ${modelName}`
            };
        }

        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Generate a summary using the chat model
 * Use for document summarization during ingestion
 */
export async function generateSummary(prompt: string): Promise<string> {
    const settings = getSettings();
    const ollama = getOllama();
    try {
        const response = await ollama.generate({
            model: settings.chatModel,
            prompt: prompt,
            options: {
                temperature: 0.3,
                num_predict: 100,
            }
        });
        return response.response;
    } catch (error) {
        console.error('[Ollama] Error generating summary:', error);
        // Return empty string on error - let caller handle gracefully
        return '';
    }
}

/**
 * Get cached health status without making a request
 * Useful for UI to show last known status
 */
export function getLastHealthStatus(): OllamaHealthStatus | null {
    return cachedHealth;
}

/**
 * Clear cached health and instance (useful when settings change)
 */
export function resetOllamaConnection(): void {
    ollamaInstance = null;
    lastHostUsed = null;
    cachedHealth = null;
    healthCheckTimestamp = 0;
}
