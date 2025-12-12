import { getOllama } from './ollama';
import { getTable, resetTable, batchInsert, safeDelete, setVectorDimension } from './lancedb';
import { CONFIG } from './config';
import { getSettings } from './settings';

interface EmbeddingResponse {
    embeddings: number[][];
}

interface VectorRecord {
    [key: string]: string | number[] | 'collection' | 'document' | 'chunk';
    id: string;
    text: string;
    vector: number[];
    source: string;
    type: 'collection' | 'document' | 'chunk';
    metadata: string;
}

interface SearchResultItem {
    id: string;
    text: string;
    score: number;
    metadata: Record<string, unknown>;
    source: string;
    type: string;
}

let dimensionInitialized = false;

export async function createEmbedding(text: string): Promise<EmbeddingResponse> {
    try {
        const settings = getSettings();
        const ollama = getOllama();
        const response = await ollama.embed({
            model: settings.embeddingModel,
            input: text
        });

        // Set vector dimension based on actual model output (first time only)
        if (!dimensionInitialized && response.embeddings.length > 0) {
            const dim = response.embeddings[0].length;
            console.log(`Detected embedding dimension: ${dim} for model ${settings.embeddingModel}`);
            setVectorDimension(dim);
            dimensionInitialized = true;
        }

        return response;
    } catch (error) {
        console.error('Error creating embedding:', error);
        throw error;
    }
}

export async function clearDatabase(): Promise<void> {
    await resetTable('vectors');
    dimensionInitialized = false; // Reset so next embedding will set dimension
    console.log('Database cleared.');
}

async function upsertRecord(record: VectorRecord): Promise<void> {
    // Pass the vector dimension from the actual record
    const dim = record.vector.length;
    const table = await getTable('vectors', dim);
    // Use safe delete to prevent SQL injection
    try {
        await safeDelete('vectors', 'id', record.id);
    } catch {
        // Ignore if not found or table empty
    }
    await table.add([record]);
}

export async function storeCollection(id: string, name: string, summary: string): Promise<void> {
    const embedding = await createEmbedding(summary);
    await upsertRecord({
        id,
        text: summary,
        vector: embedding.embeddings[0],
        source: 'collection',
        type: 'collection',
        metadata: JSON.stringify({ name })
    });
}

export async function storeDocument(
    id: string,
    collectionId: string,
    summary: string,
    originalText: string,
    filePath: string
): Promise<void> {
    const embedding = await createEmbedding(summary);
    await upsertRecord({
        id,
        text: summary,
        vector: embedding.embeddings[0],
        source: filePath,
        type: 'document',
        metadata: JSON.stringify({ collectionId, originalText })
    });
}

export async function storeChunk(
    id: string,
    documentId: string,
    summary: string,
    originalText: string,
    locationVal: string
): Promise<void> {
    const embedding = await createEmbedding(summary);
    await upsertRecord({
        id,
        text: summary,
        vector: embedding.embeddings[0],
        source: locationVal,
        type: 'chunk',
        metadata: JSON.stringify({ documentId, originalText })
    });
}

// Batch store multiple chunks for better performance
export async function storeChunksBatch(
    chunks: Array<{
        id: string;
        documentId: string;
        summary: string;
        originalText: string;
        location: string;
    }>
): Promise<void> {
    if (chunks.length === 0) return;

    const records: VectorRecord[] = [];

    for (const chunk of chunks) {
        const embedding = await createEmbedding(chunk.summary);
        records.push({
            id: chunk.id,
            text: chunk.summary,
            vector: embedding.embeddings[0],
            source: chunk.location,
            type: 'chunk',
            metadata: JSON.stringify({
                documentId: chunk.documentId,
                originalText: chunk.originalText
            })
        });
    }

    await batchInsert('vectors', records);
}

export async function removeEmbedding(filename: string): Promise<void> {
    console.log(`Removing embeddings for file: ${filename}`);
    // Use safe delete to prevent SQL injection
    await safeDelete('vectors', 'source', filename);
    console.log(`Embeddings for ${filename} deleted`);
}

export async function similaritySearch(
    query: string,
    limit = CONFIG.TOP_K_RESULTS,
    filterType?: string
): Promise<SearchResultItem[]> {
    const table = await getTable('vectors');
    const queryEmbedding = await createEmbedding(query);

    let search = table.search(queryEmbedding.embeddings[0]).limit(limit);
    if (filterType) {
        // Safe filter - filterType is controlled by our code
        search = search.where(`type = '${filterType}'`);
    }

    const results = await search.toArray();
    return results.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        text: r.text as string,
        score: (1 - ((r._distance as number) || 0)),
        metadata: JSON.parse(r.metadata as string),
        source: r.source as string,
        type: r.type as string
    }));
}

interface HierarchicalSearchResult {
    bestDocument: {
        id: string;
        original_text: string;
        score: number;
    } | null;
    topChunks: Array<{
        id: string;
        original_text: string;
        score: number;
        source: string;
    }>;
}

export async function hierarchicalSearch(query: string): Promise<HierarchicalSearchResult> {
    const settings = getSettings();

    // Direct search for documents and chunks (no collection requirement)
    // This is more robust for single-vault setups
    const documents = await similaritySearch(query, settings.retrievalDocumentCount, 'document');
    const chunks = await similaritySearch(query, settings.retrievalChunkCount, 'chunk');

    console.log(`   📑 Documents found: ${documents.length}, Chunks found: ${chunks.length}`);

    // If we have a high scoring document, promote it
    const bestDocument = documents.length > 0 ? {
        id: documents[0].id,
        original_text: (documents[0].metadata?.originalText as string) || documents[0].text,
        score: documents[0].score
    } : null;

    return {
        bestDocument,
        topChunks: chunks.map(c => ({
            id: c.id,
            original_text: (c.metadata?.originalText as string) || c.text,
            score: c.score,
            source: c.source
        }))
    };
}
