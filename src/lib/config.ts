import path from 'path';

export const CONFIG = {
    OLLAMA_HOST: process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434',
    OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text',
    OLLAMA_CHAT_MODEL: process.env.OLLAMA_CHAT_MODEL ?? 'granite4:350m',

    DATA_DIR: path.join(process.cwd(), '_data'),
    get UPLOAD_DIR() {
        return path.join(this.DATA_DIR, 'upload');
    },
    get DB_PATH() {
        return path.join(this.DATA_DIR, 'embeddings.sqlite');
    },

    // Document processing
    MAX_WORDS_PER_DOC: 1500,
    CHUNK_OVERLAP: 0, // Future proofing

    // Search
    TOP_K_RESULTS: 5,
};
