import { getOllama } from './ollama';
import { getTable, resetTable } from './lancedb';
import { CONFIG } from './config';
import { getSettings } from './settings';

export async function createEmbedding(text: string) {
    try {
        // console.log('Creating embedding for text:', text.substring(0, 50) + '...');
        const settings = getSettings();
        const ollama = getOllama();
        const response = await ollama.embed({
            model: settings.embeddingModel,
            input: text
        });
        return response;
    } catch (error) {
        console.error('Error creating embedding:', error);
        throw error;
    }
}

export async function clearDatabase() {
    await resetTable('vectors');
    console.log('Database cleared.');
}

async function upsertRecord(record: any) {
    const table = await getTable('vectors');
    // LanceDB merge/upsert patterns can be complex. 
    // For simplicity: delete existing by ID then insert.
    // Efficient enough for local single-user apps.
    try {
        await table.delete(`id = "${record.id}"`);
    } catch (e) {
        // Ignore if not found or table empty
    }
    await table.add([record]);
}

export async function storeCollection(id: string, name: string, summary: string) {
    const embedding = await createEmbedding(summary);
    await upsertRecord({
        id,
        text: summary,
        vector: embedding.embeddings[0],
        source: 'collection', // Virtual source
        type: 'collection',
        metadata: JSON.stringify({ name })
    });
}

export async function storeDocument(id: string, collectionId: string, summary: string, originalText: string, filePath: string) {
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

export async function storeChunk(id: string, documentId: string, summary: string, originalText: string, locationVal: string) {
    const embedding = await createEmbedding(summary);
    await upsertRecord({
        id,
        text: summary,
        vector: embedding.embeddings[0],
        source: locationVal, // Can be filepath
        type: 'chunk',
        metadata: JSON.stringify({ documentId, originalText })
    });
}

export async function removeEmbedding(filename: string) {
    const table = await getTable('vectors');
    console.log(`Removing embeddings for file: ${filename}`);
    // Naively delete where source matches or id starts with it
    // LanceDB filters need exact matches or standard SQL-like ops.
    // We'll use source column for deletion efficiency if possible.
    await table.delete(`source = "${filename}"`);
    console.log(`Embeddings for ${filename} deleted`);
}

export async function similaritySearch(query: string, limit = CONFIG.TOP_K_RESULTS, filterType?: string) {
    const table = await getTable('vectors');
    const queryEmbedding = await createEmbedding(query);

    let search = table.search(queryEmbedding.embeddings[0]).limit(limit);
    if (filterType) {
        search = search.where(`type = '${filterType}'`);
    }

    const results = await search.toArray();
    return results.map((r: any) => ({
        id: r.id as string,
        text: r.text as string,
        score: (1 - (r._distance || 0)), // LanceDB returns distance, we want similarity
        metadata: JSON.parse(r.metadata as string),
        source: r.source as string,
        type: r.type as string
    }));
}

export async function hierarchicalSearch(query: string) {
    const settings = getSettings();

    // 1. Search Collections
    const collections = await similaritySearch(query, settings.retrievalCollectionCount, 'collection');
    if (collections.length === 0) return { bestDocument: null, topChunks: [] };

    const topCollectionIds = collections.map(c => c.id);

    // 2. Search Documents (we ideally filter by collection_id, but LanceDB filtering on JSON metadata 
    // is tricky without flattening. For this "GoTo" implementation, global search on Documents 
    // is often better than strict hierarchy anyway. Let's do a global document search 
    // but boost or filter if possible. We will stick to Global Document Search for now 
    // as it is more robust to "cross-collection" questions.)

    // Re-eval: The user wants "Second Brain". Strict hierarchy might miss things.
    // Let's do a pure similarity search on CHUNKS and DOCUMENTS directly.
    // The hierarchy is good for context but broad search is better on LanceDB.

    const documents = await similaritySearch(query, settings.retrievalDocumentCount, 'document');
    const chunks = await similaritySearch(query, settings.retrievalChunkCount, 'chunk');

    // If we have a very high scoring document, we promote it.
    const bestDocument = documents.length > 0 ? {
        id: documents[0].id,
        original_text: documents[0].metadata?.originalText || documents[0].text,
        score: documents[0].score
    } : null;

    return {
        bestDocument,
        topChunks: chunks.map(c => ({
            id: c.id,
            original_text: c.metadata?.originalText || c.text,
            score: c.score,
            source: c.source
        }))
    };
}
