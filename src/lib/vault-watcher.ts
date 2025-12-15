import fs from 'fs';
import path from 'path';
import { VaultIngestor } from './ingest';
import { getSettings } from './settings';
import { safeDelete } from './lancedb';
import crypto from 'crypto';

interface FileIndex {
    [filePath: string]: {
        mtimeMs: number;
        size: number;
    }
}

const SYNC_FILE = path.join(process.cwd(), '.vault-index.json');

// Progress callback type for UI updates
export type ProgressCallback = (current: number, total: number, currentFile: string, phase: string) => void;

// Batch processing configuration
const DEFAULT_BATCH_SIZE = 5;
const BATCH_DELAY_MS = 100; // Small delay between batches to prevent memory pressure

export class VaultWatcher {
    private ingestor: VaultIngestor;
    private vaultPath: string;
    private cancelled = false;

    constructor() {
        this.ingestor = new VaultIngestor();
        const settings = getSettings();
        this.vaultPath = settings.vaultPath;
    }

    /**
     * Cancel ongoing operations
     */
    public cancel(): void {
        this.cancelled = true;
        console.log('[VaultWatcher] Cancellation requested');
    }

    /**
     * Reset cancellation state for new operations
     */
    public reset(): void {
        this.cancelled = false;
    }

    private loadIndex(): FileIndex {
        if (fs.existsSync(SYNC_FILE)) {
            try {
                return JSON.parse(fs.readFileSync(SYNC_FILE, 'utf-8'));
            } catch (e) {
                console.error('[VaultWatcher] Failed to load vault index, creating new:', e);
                // Backup corrupted index
                try {
                    fs.renameSync(SYNC_FILE, SYNC_FILE + '.corrupted');
                } catch {
                    // Ignore backup failure
                }
            }
        }
        return {};
    }

    private saveIndex(index: FileIndex) {
        try {
            // Atomic write using temp file
            const tempFile = SYNC_FILE + '.tmp';
            fs.writeFileSync(tempFile, JSON.stringify(index, null, 2));
            fs.renameSync(tempFile, SYNC_FILE);
        } catch (e) {
            console.error('[VaultWatcher] Failed to save vault index:', e);
        }
    }

    private generateId(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    /**
     * Process files in batches to prevent memory issues with large vaults
     */
    private async processBatch(
        files: Array<{ path: string; relativePath: string; isNew: boolean }>,
        batchSize: number,
        onProgress?: ProgressCallback
    ): Promise<{ processed: number; errors: number }> {
        const result = { processed: 0, errors: 0 };
        const total = files.length;

        for (let i = 0; i < files.length; i += batchSize) {
            // Check for cancellation
            if (this.cancelled) {
                console.log('[VaultWatcher] Processing cancelled');
                break;
            }

            const batch = files.slice(i, i + batchSize);

            for (const file of batch) {
                if (this.cancelled) break;

                try {
                    const phase = file.isNew ? 'Indexing new file' : 'Updating file';
                    if (onProgress) {
                        onProgress(result.processed + 1, total, file.relativePath, phase);
                    }

                    await this.ingestor.processFile(file.path);
                    result.processed++;
                } catch (err) {
                    console.error(`[VaultWatcher] Error processing ${file.relativePath}:`, err);
                    result.errors++;
                }
            }

            // Small delay between batches to reduce memory pressure
            if (i + batchSize < files.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }

        return result;
    }

    /**
     * Check and sync vault with progress reporting
     */
    public async checkAndSync(
        onProgress?: ProgressCallback,
        batchSize = DEFAULT_BATCH_SIZE
    ): Promise<{
        added: number;
        updated: number;
        deleted: number;
        errors: number;
        cancelled: boolean;
    }> {
        this.reset();

        if (!fs.existsSync(this.vaultPath)) {
            console.error('[VaultWatcher] Vault path does not exist:', this.vaultPath);
            return { added: 0, updated: 0, deleted: 0, errors: 0, cancelled: false };
        }

        const storedIndex = this.loadIndex();
        const newIndex: FileIndex = {};
        const stats = { added: 0, updated: 0, deleted: 0, errors: 0, cancelled: false };

        // Phase 1: Scan for files
        if (onProgress) onProgress(0, 0, '', 'Scanning vault...');

        const currentFiles = this.ingestor.getMarkdownFiles(this.vaultPath);

        // Categorize files
        const toProcess: Array<{ path: string; relativePath: string; isNew: boolean }> = [];

        for (const filePath of currentFiles) {
            if (this.cancelled) {
                stats.cancelled = true;
                break;
            }

            try {
                const stat = fs.statSync(filePath);
                const relativePath = path.relative(this.vaultPath, filePath);

                newIndex[relativePath] = {
                    mtimeMs: stat.mtimeMs,
                    size: stat.size
                };

                const stored = storedIndex[relativePath];

                if (!stored) {
                    toProcess.push({ path: filePath, relativePath, isNew: true });
                } else if (stored.mtimeMs !== stat.mtimeMs || stored.size !== stat.size) {
                    toProcess.push({ path: filePath, relativePath, isNew: false });
                }
            } catch (err) {
                console.error(`[VaultWatcher] Error scanning ${filePath}:`, err);
                stats.errors++;
            }
        }

        // Phase 2: Process changes in batches
        if (toProcess.length > 0 && !this.cancelled) {
            console.log(`[VaultWatcher] Processing ${toProcess.length} files in batches of ${batchSize}`);

            const processResult = await this.processBatch(toProcess, batchSize, onProgress);
            stats.errors += processResult.errors;

            // Count added vs updated
            for (const file of toProcess) {
                if (file.isNew) stats.added++;
                else stats.updated++;
            }
        }

        // Phase 3: Handle deletions
        if (!this.cancelled) {
            const deletedFiles = Object.keys(storedIndex).filter(p => !newIndex[p]);

            for (const relativePath of deletedFiles) {
                if (this.cancelled) break;

                if (onProgress) {
                    onProgress(0, deletedFiles.length, relativePath, 'Removing deleted file');
                }

                try {
                    const docId = this.generateId(relativePath);
                    await safeDelete('vectors', 'id', docId);
                    await safeDelete('vectors', 'source', relativePath);
                    stats.deleted++;
                    console.log(`[VaultWatcher] Deleted: ${relativePath}`);
                } catch (err) {
                    console.error(`[VaultWatcher] Error deleting ${relativePath}:`, err);
                    stats.errors++;
                }
            }
        }

        // Save updated index
        if (!this.cancelled) {
            this.saveIndex(newIndex);
        }

        stats.cancelled = this.cancelled;
        return stats;
    }

    /**
     * Check for changes without ingesting - for startup popup
     */
    public checkOnly(): { newFiles: string[], modifiedFiles: string[], deletedFiles: string[] } {
        const result = { newFiles: [] as string[], modifiedFiles: [] as string[], deletedFiles: [] as string[] };

        if (!fs.existsSync(this.vaultPath)) {
            return result;
        }

        const storedIndex = this.loadIndex();
        const currentSet = new Set<string>();

        // Get current files
        const currentFiles = this.ingestor.getMarkdownFiles(this.vaultPath);

        for (const filePath of currentFiles) {
            try {
                const stat = fs.statSync(filePath);
                const relativePath = path.relative(this.vaultPath, filePath);
                currentSet.add(relativePath);

                const stored = storedIndex[relativePath];

                if (!stored) {
                    result.newFiles.push(relativePath);
                } else if (stored.mtimeMs !== stat.mtimeMs || stored.size !== stat.size) {
                    result.modifiedFiles.push(relativePath);
                }
            } catch (err) {
                // Skip files we can't stat
            }
        }

        // Check for deletions
        for (const relativePath in storedIndex) {
            if (!currentSet.has(relativePath)) {
                result.deletedFiles.push(relativePath);
            }
        }

        return result;
    }

    /**
     * Get statistics about the vault
     */
    public getStats(): {
        totalFiles: number;
        indexedFiles: number;
        vaultExists: boolean;
        vaultPath: string;
    } {
        const vaultExists = fs.existsSync(this.vaultPath);
        const index = this.loadIndex();
        const indexedFiles = Object.keys(index).length;

        let totalFiles = 0;
        if (vaultExists) {
            try {
                totalFiles = this.ingestor.getMarkdownFiles(this.vaultPath).length;
            } catch {
                // Ignore errors
            }
        }

        return {
            totalFiles,
            indexedFiles,
            vaultExists,
            vaultPath: this.vaultPath
        };
    }
}
