import fs from 'fs/promises';
import path from 'path';
import { storeCollection, storeDocument, storeChunk } from './vector-store';
import { generateSummary } from './ollama';
import { CONFIG } from './config';

const VALID_FILE_EXTS = ['.md', '.txt', '.html', '.csv'];

export type ExtractDocument = {
    name: string;
    content: string;
}

export class DocumentProcessor {
    directory: string;
    documents: ExtractDocument[];
    maxWordsPerDoc: number;

    constructor(directory: string, maxWordsPerDoc = CONFIG.MAX_WORDS_PER_DOC) {
        this.directory = directory;
        this.documents = [];
        this.maxWordsPerDoc = maxWordsPerDoc;
    }

    async loadDocuments(directory = this.directory, depth = 10) {
        if (depth < 0) {
            return; // Stop recursion if max depth is reached
        }

        try {
            const files = await fs.readdir(directory, { withFileTypes: true });
            for (const file of files) {
                const fullPath = path.join(directory, file.name);
                if (file.isDirectory()) {
                    // If it's a directory, go deeper, reducing depth by 1
                    await this.loadDocuments(fullPath, depth - 1);
                } else if (file.isFile()) {
                    await this.processFile(fullPath);
                }
            }
        } catch (error) {
            console.error(`Error loading documents from ${directory}:`, error);
        }
    }

    async processFile(filePath: string, onProgress?: (msg: string) => void) {
        try {
            const fileName = path.basename(filePath);
            const collectionId = fileName; // Use filename as collection ID for now
            if (onProgress) onProgress(`Reading ${fileName}...`);

            const content = await fs.readFile(filePath, 'utf-8');
            const processedContent = this.preprocessText(content);

            // Level 2: Documents (Pages)
            // Target ~1000 tokens per page. Assuming ~4 chars per token -> 4000 chars.
            if (onProgress) onProgress(`Splitting ${fileName} into pages...`);
            const pages = this.splitIntoPages(processedContent, 4000);
            const docSummaries: string[] = [];

            for (let i = 0; i < pages.length; i++) {
                const pageContent = pages[i];
                const docId = `${collectionId}_page_${i + 1}`;

                // Level 3: Chunks
                // Target ~500 tokens per chunk. Assuming ~4 chars per token -> 2000 chars.
                // We temporarily override maxWordsPerDoc for chunking logic if needed, 
                // but splitIntoChunks uses this.maxWordsPerDoc. 
                // Let's create a local chunker or just use splitIntoChunks with the instance's config 
                // but we need to ensure instance is configured correctly or we pass a size.
                // For now, let's assume splitIntoChunks respects this.maxWordsPerDoc which is 1500 words (~6000 chars).
                // We want smaller chunks. Let's manually chunk here or adjust splitIntoChunks.
                // I'll add a chunkSize param to splitIntoChunks or just use a helper.

                if (onProgress) onProgress(`Processing page ${i + 1}/${pages.length}...`);

                // Using a smaller chunk size for the hierarchy
                const chunkSize = 2000; // ~500 tokens
                const chunks = this.splitTextIntoChunks(docId, pageContent, chunkSize);
                const chunkSummaries: string[] = [];

                for (let j = 0; j < chunks.length; j++) {
                    const chunk = chunks[j];
                    const chunkId = chunk.name;

                    // Generate Chunk Summary
                    const chunkSummary = await generateSummary(`Summarize this text in 2-3 sentences: ${chunk.content}`);
                    chunkSummaries.push(chunkSummary);

                    // Store Chunk
                    await storeChunk(chunkId, docId, chunkSummary, chunk.content, filePath);
                }

                // Generate Document Summary
                const docSummaryPrompt = `Summarize these key points into a cohesive 2-3 sentence overview: ${chunkSummaries.join('\n')}`;
                const docSummary = await generateSummary(docSummaryPrompt);
                docSummaries.push(docSummary);

                // Store Document
                await storeDocument(docId, collectionId, docSummary, pageContent, filePath);
            }

            // Generate Collection Summary
            if (onProgress) onProgress(`Generating summary for ${fileName}...`);
            const collectionSummaryPrompt = `Summarize this document's main themes and topics in 2-3 sentences: ${docSummaries.join('\n')}`;
            const collectionSummary = await generateSummary(collectionSummaryPrompt);

            // Store Collection
            await storeCollection(collectionId, fileName, collectionSummary);

            if (onProgress) onProgress(`Finished processing ${fileName}`);
        } catch (err) {
            console.warn(`Skipping file ${filePath} (not text or unreadable):`, err);
            if (onProgress) onProgress(`Error processing ${path.basename(filePath)}: ${err}`);
        }
    }

    splitIntoPages(text: string, charsPerPage = 4000): string[] {
        const pages: string[] = [];
        let start = 0;

        while (start < text.length) {
            let end = start + charsPerPage;
            if (end >= text.length) {
                end = text.length;
            } else {
                // Find natural break
                const lookback = Math.min(500, charsPerPage * 0.2);
                const window = text.substring(end - lookback, end);
                const lastPeriod = window.lastIndexOf('. ');
                const lastNewline = window.lastIndexOf('\n');

                if (lastNewline !== -1) {
                    end = end - lookback + lastNewline + 1;
                } else if (lastPeriod !== -1) {
                    end = end - lookback + lastPeriod + 2;
                }
            }

            pages.push(text.substring(start, end).trim());
            start = end;
        }
        return pages;
    }

    splitTextIntoChunks(baseId: string, content: string, chunkSize: number): ExtractDocument[] {
        const docs: ExtractDocument[] = [];
        let start = 0;
        let chunkIndex = 1;
        const overlap = 100;

        while (start < content.length) {
            let end = start + chunkSize;

            if (end >= content.length) {
                end = content.length;
            } else {
                const lookback = Math.min(100, chunkSize * 0.2);
                const textWindow = content.substring(end - lookback, end);
                const breakPoints = ['\n\n', '\n', '. ', ' '];

                for (const bp of breakPoints) {
                    const lastIndex = textWindow.lastIndexOf(bp);
                    if (lastIndex !== -1) {
                        end = end - lookback + lastIndex + bp.length;
                        break;
                    }
                }
            }

            const chunkText = content.substring(start, end).trim();
            if (chunkText.length > 0) {
                docs.push({
                    name: `${baseId}_chunk_${chunkIndex++}`,
                    content: chunkText
                });
            }

            start = end - overlap;
            if (start <= 0 && chunkIndex > 1) start = end; // Avoid infinite loop if overlap issues
            if (end === content.length) break;
        }
        return docs;
    }

    preprocessText(text: string) {
        return text.toLowerCase();
    }

    splitIntoChunks(fileName: string, content: string) {
        const docs: ExtractDocument[] = [];
        const chunkSize = this.maxWordsPerDoc; // Treating as characters for better control
        const overlap = 50; // Character overlap

        // Simple recursive splitting strategy
        const splitText = (text: string): string[] => {
            if (text.length <= chunkSize) return [text];

            const separators = ['\n\n', '\n', '. ', ' '];
            let separator = '';
            let splitIndex = -1;

            for (const sep of separators) {
                // Find the last occurrence of separator within the chunk limit
                const limit = text.substring(0, chunkSize).lastIndexOf(sep);
                if (limit !== -1) {
                    splitIndex = limit;
                    separator = sep;
                    break;
                }
            }

            if (splitIndex === -1) {
                // Force split if no separator found
                splitIndex = chunkSize;
            }

            const chunk = text.substring(0, splitIndex);
            const remaining = text.substring(splitIndex + separator.length);

            // Add overlap to the remaining part for the next chunk
            const nextChunkStart = Math.max(0, splitIndex - overlap);
            const nextText = text.substring(nextChunkStart);

            // Avoid infinite recursion if we're not making progress
            if (nextText.length >= text.length) {
                return [text.substring(0, chunkSize), ...splitText(text.substring(chunkSize))];
            }

            return [chunk, ...splitText(remaining)];
        };

        // Better implementation: Iterative approach with overlap
        let start = 0;
        let chunkIndex = 1;

        while (start < content.length) {
            let end = start + chunkSize;

            if (end >= content.length) {
                end = content.length;
            } else {
                // Try to find a natural break point
                const lookback = Math.min(100, chunkSize * 0.2); // Look back 20% or 100 chars
                const textWindow = content.substring(end - lookback, end);

                const breakPoints = ['\n\n', '\n', '. ', ' '];
                let foundBreak = false;

                for (const bp of breakPoints) {
                    const lastIndex = textWindow.lastIndexOf(bp);
                    if (lastIndex !== -1) {
                        end = end - lookback + lastIndex + bp.length;
                        foundBreak = true;
                        break;
                    }
                }
            }

            const chunkText = content.substring(start, end).trim();
            if (chunkText.length > 0) {
                docs.push({
                    name: `${fileName}_chunk_${chunkIndex++}`,
                    content: chunkText
                });
            }

            // Move start forward, but keep overlap
            start = end - overlap;

            // Prevent infinite loop if overlap is too big or no progress
            if (start <= 0) start = end; // Should not happen with logic above but safety
            if (end === content.length) break;
        }

        return docs;
    }
}
