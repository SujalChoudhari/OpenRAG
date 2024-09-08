import { Ollama } from "ollama";

async function createEmbedding(text: string) {
    try {
        const ollama = new Ollama({ host: 'http://192.168.1.43:11434/' });
        const response = ollama.embed({ model: "nomic-embed-text", input: text });
        return response;
    } catch (error) {
        console.error('Error creating embedding:', error);
        throw error;
    }
}

export default createEmbedding;