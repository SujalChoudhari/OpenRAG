import { getOllama } from './ollama';
import { getDb } from './db';
import { CONFIG } from './config';
import { getSettings } from './settings';

export async function createEmbedding(text: string) {
    try {
        console.log('Creating embedding for text:', text.substring(0, 50) + '...');
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

export async function storeEmbedding(text: string, id: string) {
    const db = await getDb();

    // Check if the embedding already exists
    const existingEmbedding = await db.get(
        'SELECT * FROM embeddings WHERE id = ?',
        [id]
    );

    if (existingEmbedding) {
        console.log(`Embedding with id ${id} already exists. Skipping creation.`);
        return;
    }

    // If it doesn't exist, create and store the new embedding
    const embedding = await createEmbedding(text);
    await db.run(
        'INSERT INTO embeddings (id, text, embedding) VALUES (?, ?, ?)',
        [id, text, Buffer.from(new Float32Array(embedding.embeddings[0]).buffer)]
    );

    console.log(`New embedding created and stored for id ${id}`);
}

export async function storeCollection(id: string, name: string, summary: string) {
    const db = await getDb();
    const embedding = await createEmbedding(summary);
    await db.run(
        'INSERT OR REPLACE INTO collections (id, name, summary, embedding) VALUES (?, ?, ?, ?)',
        [id, name, summary, Buffer.from(new Float32Array(embedding.embeddings[0]).buffer)]
    );
}

export async function storeDocument(id: string, collectionId: string, summary: string, originalText: string) {
    const db = await getDb();
    const embedding = await createEmbedding(summary);
    await db.run(
        'INSERT OR REPLACE INTO documents (id, collection_id, summary, embedding, original_text) VALUES (?, ?, ?, ?, ?)',
        [id, collectionId, summary, Buffer.from(new Float32Array(embedding.embeddings[0]).buffer), originalText]
    );
}

export async function storeChunk(id: string, documentId: string, summary: string, originalText: string) {
    const db = await getDb();
    const embedding = await createEmbedding(summary);
    await db.run(
        'INSERT OR REPLACE INTO chunks (id, document_id, summary, embedding, original_text) VALUES (?, ?, ?, ?, ?)',
        [id, documentId, summary, Buffer.from(new Float32Array(embedding.embeddings[0]).buffer), originalText]
    );
}

export async function removeEmbedding(filename: string) {
    const db = await getDb();
    console.log(`Removing embeddings for file: ${filename}`);

    // if id starts with filename delete it...
    await db.run('DELETE FROM embeddings WHERE id LIKE ?', [filename + '%']);

    console.log(`Embeddings for ${filename} deleted`);
}

// Helper function to calculate dot product
function dotProduct(a: Float32Array, b: Float32Array) {
    return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

export async function similaritySearch(query: string, topK = CONFIG.TOP_K_RESULTS) {
    const db = await getDb();

    const queryEmbedding = await createEmbedding(query);
    const queryEmbeddingArray = new Float32Array(queryEmbedding.embeddings[0]);

    const rows = await db.all(`SELECT id, text, embedding FROM embeddings`);

    const results = rows.map(row => {
        const embeddingArray = new Float32Array(row.embedding.buffer);
        const similarity = dotProduct(queryEmbeddingArray, embeddingArray);
        return { id: row.id, text: row.text, similarity };
    });

    // Sort by similarity and return top K
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
}

export async function hierarchicalSearch(query: string) {
    const settings = getSettings();
    const db = await getDb();
    const queryEmbedding = await createEmbedding(query);
    const queryVector = new Float32Array(queryEmbedding.embeddings[0]);

    // Stage 1: Search Collections
    const collections = await db.all('SELECT id, name, summary, embedding FROM collections');
    const collectionScores = collections.map(c => ({
        ...c,
        score: dotProduct(queryVector, new Float32Array(c.embedding.buffer))
    })).sort((a, b) => b.score - a.score).slice(0, settings.retrievalCollectionCount);

    const topCollectionIds = collectionScores.map(c => c.id);
    if (topCollectionIds.length === 0) return { bestDocument: null, topChunks: [] };

    // Stage 2: Search Documents within top Collections
    const placeholders = topCollectionIds.map(() => '?').join(',');
    const documents = await db.all(
        `SELECT id, collection_id, summary, embedding, original_text FROM documents WHERE collection_id IN (${placeholders})`,
        topCollectionIds
    );

    const documentScores = documents.map(d => ({
        ...d,
        score: dotProduct(queryVector, new Float32Array(d.embedding.buffer))
    })).sort((a, b) => b.score - a.score).slice(0, settings.retrievalDocumentCount);

    const topDocumentIds = documentScores.map(d => d.id);
    if (topDocumentIds.length === 0) return { bestDocument: null, topChunks: [] };

    // Stage 3: Search Chunks within top Documents
    const docPlaceholders = topDocumentIds.map(() => '?').join(',');
    const chunks = await db.all(
        `SELECT id, document_id, summary, embedding, original_text FROM chunks WHERE document_id IN (${docPlaceholders})`,
        topDocumentIds
    );

    const chunkScores = chunks.map(c => ({
        ...c,
        score: dotProduct(queryVector, new Float32Array(c.embedding.buffer))
    })).sort((a, b) => b.score - a.score).slice(0, settings.retrievalChunkCount);

    const bestDocument = documentScores[0];

    return {
        bestDocument,
        topChunks: chunkScores
    };
}
