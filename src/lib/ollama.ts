import { Ollama } from 'ollama';
import { getSettings } from './settings';

export const getOllama = () => {
    const settings = getSettings();
    return new Ollama({
        host: settings.ollamaHost,
    });
};

export async function generateSummary(prompt: string): Promise<string> {
    const settings = getSettings();
    const ollama = getOllama();
    try {
        const response = await ollama.generate({
            model: settings.chatModel,
            prompt: prompt,
            options: {
                temperature: 0.3,
                num_predict: 100,
            }
        });
        return response.response;
    } catch (error) {
        console.error('Error generating summary:', error);
        return '';
    }
}
