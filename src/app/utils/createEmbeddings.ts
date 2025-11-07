import { Ollama } from "ollama";

async function createEmbedding(text: string) {
    try {
        console.log('Creating embedding for text:', text);
        const ollama = new Ollama({ 
            host: process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434'
        });
        const response = await ollama.embed({ model: "nomic-embed-text", input: text });
        return response;
    } catch (error) {
        console.error('Error creating embedding:', error);
        throw error;
    }
}

export default createEmbedding;