import path from 'path';

// Debug mode - set to true in development for verbose logging
export const DEBUG = process.env.NODE_ENV === 'development';

export const CONFIG = {
    OLLAMA_HOST: process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434',
    OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL ?? 'mahonzhan/all-MiniLM-L6-v2:latest',
    OLLAMA_CHAT_MODEL: process.env.OLLAMA_CHAT_MODEL ?? 'qwen3:0.6b',

    DATA_DIR: path.join(process.cwd(), '_data'),
    get UPLOAD_DIR() {
        return path.join(this.DATA_DIR, 'upload');
    },
    get LANCEDB_URI() {
        return path.join(this.DATA_DIR, 'lancedb');
    },

    // Document processing
    MAX_WORDS_PER_DOC: 1500,

    // Search
    TOP_K_RESULTS: 5,
};
