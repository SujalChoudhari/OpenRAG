import createEmbedding from '@/app/utils/createEmbeddings';
import { clearMessages, storeMessage } from '@/app/utils/database';
import { LoadDocuments } from '@/app/utils/loadDocs';
import { systemPrompt } from '@/app/utils/prompt';
import { similaritySearch } from '@/app/utils/sqliteEmbeddings';
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

    const loadDocs = new LoadDocuments('_data');
    loadDocs.loadDocuments();

    clearMessages();
    for (const message of messages) {
        await storeMessage(message);
    }

    messages[messages.length - 1].data = context;

    const ollama = createOllama({
        baseURL: 'http://192.168.1.43:11434/api',
    })
    const result = await streamText({
        model: ollama('qwen2:0.5b'),
        system: systemPrompt(context),
        messages: convertToCoreMessages(messages),
    });

    return result.toDataStreamResponse();
}