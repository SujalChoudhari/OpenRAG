import { createSession, getSession, saveSession, ChatSession } from '@/lib/chat-history';
import { systemPrompt } from '@/lib/prompts';
import { hierarchicalSearch } from '@/lib/vector-store';
import { getSettings } from '@/lib/settings';
import { convertToCoreMessages, streamText, generateText, StreamData } from 'ai';
import { createOllama } from 'ollama-ai-provider';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '@/lib/config';

// Allow streaming responses up to 30 seconds
export const maxDuration = 300;

async function generateTitle(messages: any[], settings: any) {
    try {
        const ollama = createOllama({ baseURL: settings.ollamaHost + '/api' });
        const userMessage = messages.find(m => m.role === 'user')?.content || 'New Chat';

        const { text } = await generateText({
            model: ollama(settings.chatModel),
            prompt: `Generate a very short, concise title (max 4 words) for a chat that starts with this message: "${userMessage}". Do not use quotes.`,
        });
        return text.trim();
    } catch (error) {
        console.error('Error generating title:', error);
        return 'New Chat';
    }
}

export async function POST(req: Request) {
    const { messages, sessionId } = await req.json();

    let session: ChatSession | null = null;
    let isNewSession = false;

    if (sessionId) {
        session = getSession(sessionId);
    }

    if (!session) {
        const newId = sessionId || Date.now().toString();
        session = createSession(newId);
        isNewSession = true;
    }

    // Save user message
    const lastMessage = messages[messages.length - 1];
    session.messages.push(lastMessage);
    saveSession(session);

    // Context retrieval
    const searchResult = await hierarchicalSearch(lastMessage.content);
    let context = "";

    if (searchResult.bestDocument) {
        context += `Best Matching Document:\n${searchResult.bestDocument.original_text}\n\n`;
    }

    if (searchResult.topChunks.length > 0) {
        context += `Top Matching Chunks:\n`;
        searchResult.topChunks.forEach((chunk, index) => {
            context += `Chunk ${index + 1}:\n${chunk.original_text}\n\n`;
        });
    }

    const sources = searchResult.topChunks.map(chunk => ({
        id: chunk.id,
        text: chunk.original_text,
        similarity: chunk.score
    }));

    if (searchResult.bestDocument) {
        sources.unshift({
            id: searchResult.bestDocument.id,
            text: searchResult.bestDocument.original_text,
            similarity: searchResult.bestDocument.score
        });
    }

    // Handle @filename referencing
    const fileRegex = /@([\w.-]+)/g;
    const matches = lastMessage.content.matchAll(fileRegex);
    for (const match of matches) {
        const fileName = match[1];
        const filePath = path.join(CONFIG.UPLOAD_DIR, fileName);
        if (fs.existsSync(filePath)) {
            try {
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                context += `\n\n--- Referenced File: ${fileName} ---\n${fileContent}\n--- End of File ---\n\n`;
            } catch (err) {
                console.error(`Error reading referenced file ${fileName}:`, err);
            }
        }
    }

    const settings = getSettings();
    const ollama = createOllama({
        baseURL: settings.ollamaHost + '/api',
    });

    // Generate title in background if it's the first user message
    if (session.messages.filter(m => m.role === 'user').length === 1) {
        generateTitle(messages, settings).then(title => {
            if (session) {
                session.title = title;
                saveSession(session);
            }
        });
    }

    const data = new StreamData();
    data.append({ sources: sources });

    const prompt = settings.systemPrompt ? settings.systemPrompt.replace('${sources}', context) : systemPrompt(context);

    try {
        const result = await streamText({
            model: ollama(settings.chatModel),
            system: prompt,
            messages: convertToCoreMessages(messages),
            onFinish: async (completion) => {
                // Save assistant response
                if (session) {
                    session.messages.push({
                        id: Date.now().toString(), // Simple ID generation
                        role: 'assistant',
                        content: completion.text,
                        annotations: [{ type: 'sources', sources: sources }]
                    });
                    saveSession(session);
                }
                data.close();
            }
        });

        return result.toDataStreamResponse({
            data,
            headers: {
                'X-Session-Id': session.id
            }
        });
    } catch (error) {
        console.error('Stream error:', error);
        data.close();
        return new Response('Error generating response', { status: 500 });
    }
}
