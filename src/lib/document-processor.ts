import fs from 'fs/promises';
import path from 'path';
import { storeEmbedding } from './vector-store';
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
                } else if (file.isFile() && VALID_FILE_EXTS.includes(path.extname(file.name))) {
                    // If it's a supported file, process it
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const processedContent = this.preprocessText(content);
                    const docs = this.splitIntoChunks(file.name, processedContent);
                    for (const doc of docs) {
                        await storeEmbedding(doc.content, doc.name);
                    }
                }
            }
        } catch (error) {
            console.error(`Error loading documents from ${directory}:`, error);
        }
    }

    preprocessText(text: string) {
        return text.toLowerCase();
    }

    splitIntoChunks(fileName: string, content: string) {
        const docs: ExtractDocument[] = [];
        for (let i = 0; i < content.length; i += this.maxWordsPerDoc) {
            const chunk = content.slice(i, i + this.maxWordsPerDoc);
            docs.push({
                name: `${fileName}_chunk_${Math.floor(i / this.maxWordsPerDoc) + 1}`,
                content: chunk
            });
        }
        return docs;
    }

    // This method seems unused in the original code but kept for compatibility/utility
    getDocumentSnippet(docName: string, maxLength = 200) {
        const doc = this.documents.find(d => d.name === docName);
        if (doc) {
            return doc.content.slice(0, maxLength) + '...';
        }
        return '';
    }
}
