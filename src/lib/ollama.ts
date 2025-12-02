import { Ollama } from 'ollama';
import { getSettings } from './settings';

export const getOllama = () => {
    const settings = getSettings();
    return new Ollama({
        host: settings.ollamaHost,
    });
};
