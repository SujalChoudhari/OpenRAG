import { createSession, getSession, saveSession, ChatSession } from '@/lib/chat-history';
import { systemPrompt } from '@/lib/prompts';
import { similaritySearch } from '@/lib/vector-store';
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
    const relevantDocs = await similaritySearch(lastMessage.content);
    let context = "";
    relevantDocs.forEach((doc, index) => {
        context += `Source ${index + 1}:\n${doc.text}\n\n`;
    });

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
    data.append({ sources: relevantDocs });

    try {
        const result = await streamText({
            model: ollama(settings.chatModel),
            system: systemPrompt(context),
            messages: convertToCoreMessages(messages),
            onFinish: async (completion) => {
                // Save assistant response
                if (session) {
                    session.messages.push({
                        id: Date.now().toString(), // Simple ID generation
                        role: 'assistant',
                        content: completion.text,
                        annotations: [{ type: 'sources', sources: relevantDocs }]
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
