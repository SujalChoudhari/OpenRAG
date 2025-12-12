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

export class VaultWatcher {
    private ingestor: VaultIngestor;
    private vaultPath: string;

    constructor() {
        this.ingestor = new VaultIngestor();
        const settings = getSettings();
        this.vaultPath = settings.vaultPath;
    }

    private loadIndex(): FileIndex {
        if (fs.existsSync(SYNC_FILE)) {
            try {
                return JSON.parse(fs.readFileSync(SYNC_FILE, 'utf-8'));
            } catch (e) {
                console.error('Failed to load vault index:', e);
            }
        }
        return {};
    }

    private saveIndex(index: FileIndex) {
        try {
            fs.writeFileSync(SYNC_FILE, JSON.stringify(index, null, 2));
        } catch (e) {
            console.error('Failed to save vault index:', e);
        }
    }

    private generateId(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    public async checkAndSync(): Promise<{ added: number, updated: number, deleted: number }> {
        if (!fs.existsSync(this.vaultPath)) {
            console.error('Vault path does not exist');
            return { added: 0, updated: 0, deleted: 0 };
        }

        const storedIndex = this.loadIndex();
        const newIndex: FileIndex = {};
        const stats = { added: 0, updated: 0, deleted: 0 };

        // Get current files
        const currentFiles = this.ingestor.getMarkdownFiles(this.vaultPath);

        // 1. Detect Added and Updated files
        for (const filePath of currentFiles) {
            try {
                const stat = fs.statSync(filePath);
                const relativePath = path.relative(this.vaultPath, filePath);

                newIndex[relativePath] = {
                    mtimeMs: stat.mtimeMs,
                    size: stat.size
                };

                const stored = storedIndex[relativePath];

                if (!stored) {
                    console.log(`[VaultWatch] New file detected: ${relativePath}`);
                    await this.ingestor.processFile(filePath);
                    stats.added++;
                } else if (stored.mtimeMs !== stat.mtimeMs || stored.size !== stat.size) {
                    console.log(`[VaultWatch] Modified file detected: ${relativePath}`);
                    // Re-ingest (processFile handles upsert usually, but we might want to delete old chunks if they changed significantly)
                    // For now, processFile overwrites document but chunks are additive if we don't clear.
                    // Ideally we should delete first for strict correctness, but overwrite is okay for now.
                    await this.ingestor.processFile(filePath);
                    stats.updated++;
                }
            } catch (err) {
                console.error(`Error processing file ${filePath}:`, err);
            }
        }

        // 2. Detect Deleted files
        for (const relativePath in storedIndex) {
            if (!newIndex[relativePath]) {
                console.log(`[VaultWatch] Deleted file detected: ${relativePath}`);

                try {
                    // Delete from vector store
                    const docId = this.generateId(relativePath);
                    // We need to delete the document and its chunks
                    // Since we don't have a standardized "delete document" function in ingestor exposed, 
                    // we'll use safeDelete directly.
                    // NOTE: This assumes 'id' in LanceDB matches docId for the summary doc.
                    // For chunks, they are docId_chunk_N.

                    // Delete main document
                    await safeDelete('vectors', 'id', docId);

                    // Delete chunks (this is trickier with simple exact match delete)
                    // safeDelete only does exact match on ID.
                    // We need a way to delete by partial match or source field.
                    // LanceDB delete supports SQL-like filter "source = '...'"

                    await safeDelete('vectors', 'source', relativePath);

                    stats.deleted++;
                } catch (err) {
                    console.error(`Error deleting file ${relativePath}:`, err);
                }
            }
        }

        this.saveIndex(newIndex);
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
}
