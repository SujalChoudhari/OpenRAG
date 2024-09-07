import { createOllama } from 'ollama-ai-provider';
import { convertToCoreMessages, streamText } from 'ai';
import { clearMessages, storeMessage } from '@/app/utils/database';
import { JaccardSearch } from '@/app/utils/jaccardSearch';
import { prompt, systemPrompt } from '@/app/utils/prompt';
// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const jaccMeasure = new JaccardSearch("_data");


export async function POST(req: Request) {
    const { messages } = await req.json();
    if (jaccMeasure.documents.length === 0) {
        await jaccMeasure.loadDocuments();
    }
    clearMessages();
    for (const message of messages) {
        await storeMessage(message);
    }

    // check for last message
    const lastMessage = messages[messages.length - 1];
    const res = jaccMeasure.search(lastMessage.content);

    messages[messages.length - 1].content = prompt(res, lastMessage.content);
    console.log(res);

    const ollama = createOllama({
        baseURL: 'http://192.168.1.43:11434/api',
    })
    const result = await streamText({
        model: ollama('qwen2:0.5b'),
        system: systemPrompt,
        messages: convertToCoreMessages(messages),
    });

    return result.toDataStreamResponse();
}