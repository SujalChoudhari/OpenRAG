import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import createEmbedding from './createEmbeddings';

let db: Database;

async function initDatabase() {
    db = await open({
        filename: './_data/embeddings.sqlite',
        driver: sqlite3.Database
    });

    await db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      embedding BLOB NOT NULL
    )
  `);
}

export async function removeEmbedding(filename: string) {
    if (db === undefined) {
        await initDatabase();
    }
    console.log(`File ${filename} deleted`);

    // if id starts with filename delete it...
    await db.run('DELETE FROM embeddings WHERE id LIKE ?', [filename + '%']);


    console.log(`Embedding with id ${filename} deleted`);
}

async function storeEmbedding(text: string, id: string) {
    if (db === undefined) {
        await initDatabase();
    }

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

// Helper function to calculate dot product
function dotProduct(a: Float32Array, b: Float32Array) {
    return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

async function similaritySearch(query: string, topK = 3) {
    if (db === undefined) {
        await initDatabase();
    }
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

export { initDatabase, similaritySearch, storeEmbedding };
