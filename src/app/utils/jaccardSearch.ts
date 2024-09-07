const fs = require('fs').promises;
const path = require('path');

export type ExtractDocument = {
    name: string;
    content: string[];
}

export class JaccardSearch {
    directory: string;
    documents: ExtractDocument[];
    maxWordsPerDoc: number;

    constructor(directory: string, maxWordsPerDoc = 10) {
        this.directory = directory;
        this.documents = [];
        this.maxWordsPerDoc = maxWordsPerDoc;
    }

    async loadDocuments(directory = this.directory, depth = 10) {
        if (depth < 0) {
            return; // Stop recursion if max depth is reached
        }

        const files = await fs.readdir(directory, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(directory, file.name);

            if (file.isDirectory()) {
                // If it's a directory, go deeper, reducing depth by 1
                await this.loadDocuments(fullPath, depth - 1);
            } else if (file.isFile() && path.extname(file.name) === '.md') {
                // If it's a markdown file, process the file
                const content = await fs.readFile(fullPath, 'utf-8');
                const processedContent = this.preprocessText(content);
                this.splitIntoChunks(file.name, processedContent);
            }
        }
    }

    preprocessText(text: string) {
        return text.toLowerCase().split(/\s+/);
    }

    // Split content into chunks of maxWordsPerDoc words
    splitIntoChunks(fileName: string, content: string[]) {
        for (let i = 0; i < content.length; i += this.maxWordsPerDoc) {
            const chunk = content.slice(i, i + this.maxWordsPerDoc);
            this.documents.push({
                name: `${fileName}_chunk_${Math.floor(i / this.maxWordsPerDoc) + 1}`,
                content: chunk
            });
        }
    }

    jaccardSimilarity(set1: Set<string>, set2: Set<string>) {
        //@ts-ignore
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        //@ts-ignore
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
    }

    search(query: string, topK = 5) {
        const querySet = new Set(this.preprocessText(query));
        const results = this.documents.map(doc => ({
            name: doc.name,
            similarity: this.jaccardSimilarity(querySet, new Set(doc.content)),
            content: doc.content.join(' ')
        }));

        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    getDocumentSnippet(docName: string, maxLength = 200) {
        const doc = this.documents.find(d => d.name === docName);
        if (doc) {
            return doc.content.slice(0, maxLength).join(' ') + '...';
        }
        return '';
    }
}
