import fs from 'fs';
import path from 'path';
import { storeDocument, storeChunk } from './vector-store';
import { getSettings } from './settings';
import crypto from 'crypto';

function generateId(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

export class VaultIngestor {
    private vaultPath: string;

    constructor() {
        const settings = getSettings();
        this.vaultPath = settings.vaultPath;
    }

    async scanAndIngest() {
        if (!fs.existsSync(this.vaultPath)) {
            console.error(`Vault path does not exist: ${this.vaultPath}`);
            return;
        }

        const files = this.getMarkdownFiles(this.vaultPath);

        for (const file of files) {
            await this.processFile(file);
        }
    }

    public getMarkdownFiles(dir: string): string[] {
        // Guard against empty or invalid path
        if (!dir || dir.trim() === '') {
            return [];
        }

        if (!fs.existsSync(dir)) {
            return [];
        }

        let results: string[] = [];
        const list = fs.readdirSync(dir);

        list.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                if (!file.startsWith('.')) { // Ignore hidden dirs
                    results = results.concat(this.getMarkdownFiles(filePath));
                }
            } else {
                if (file.endsWith('.md')) {
                    results.push(filePath);
                }
            }
        });
        return results;
    }

    public async processFile(filePath: string) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const relativePath = path.relative(this.vaultPath, filePath);
            const filename = path.basename(filePath, '.md');

            // Parse Frontmatter and Content
            const parts = content.split(/^---$/gm);
            let body = content;
            let metadata = {};

            if (parts.length >= 3) {
                // simple frontmatter extraction
                // body is parts.slice(2).join('---');
                body = parts.slice(2).join('---').trim();
            }

            // Extract Links (NavDown / Connections)
            const linkRegex = /\[\[(.*?)\]\]/g;
            const links = Array.from(body.matchAll(linkRegex)).map(m => m[1]);

            // Generate Document ID
            const docId = generateId(relativePath);

            // Store full document
            await storeDocument(
                docId,
                'vault', // collectionId
                `${filename}\n${body.substring(0, 500)}`, // summary 
                body,
                relativePath
            );

            // Chunking Strategy for "Person" files
            // If the file is small (< 2000 chars), we treat it as one chunk or split by newlines.
            // If it's structured with headers, we split by headers.

            const chunks = this.smartChunk(body);
            for (let i = 0; i < chunks.length; i++) {
                const chunkId = `${docId}_chunk_${i}`;
                await storeChunk(
                    chunkId,
                    docId,
                    chunks[i].substring(0, 300), // summary
                    chunks[i],
                    relativePath
                );
            }

        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
        }
    }

    private smartChunk(text: string): string[] {
        // Split by Double Newlines first (paragraphs)
        const paragraphs = text.split(/\n\s*\n/);
        const MAX_CHUNK_SIZE = 1500;

        const chunks: string[] = [];
        let currentChunk = "";

        for (const p of paragraphs) {
            if ((currentChunk.length + p.length) > MAX_CHUNK_SIZE) {
                if (currentChunk) chunks.push(currentChunk.trim());
                currentChunk = p;
            } else {
                currentChunk += (currentChunk ? "\n\n" : "") + p;
            }
        }
        if (currentChunk) chunks.push(currentChunk.trim());

        // Filter empty chunks
        return chunks.filter(c => c.length > 20);
    }
}
