import { clearMessages, storeMessage } from '@/lib/chat-history';
import { DocumentProcessor } from '@/lib/document-processor';
import { systemPrompt } from '@/lib/prompts';
import { similaritySearch } from '@/lib/vector-store';
import { CONFIG } from '@/lib/config';
import { getSettings } from '@/lib/settings';
import { convertToCoreMessages, streamText } from 'ai';
import { createOllama } from 'ollama-ai-provider';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages } = await req.json();
    const relevantDocs = await similaritySearch(messages[messages.length - 1].content);
    let context = "";
    let count = 1;
    for (const doc of relevantDocs) {
        context += "Source " + count + ":\n" + doc.text + "\n\n";
        count += 1;
    }

    clearMessages();
    for (const message of messages) {
        await storeMessage(message);
    }

    const docProcessor = new DocumentProcessor(CONFIG.DATA_DIR);
    docProcessor.loadDocuments();

    messages[messages.length - 1].data = context;

    const settings = getSettings();

    const ollama = createOllama({
        baseURL: settings.ollamaHost + '/api',
    })
    const result = await streamText({
        model: ollama(settings.chatModel),
        system: systemPrompt(context),
        messages: convertToCoreMessages(messages),
    });

    return result.toDataStreamResponse();
}
