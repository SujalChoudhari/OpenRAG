import { createSession, getSession, saveSession, ChatSession } from '@/lib/chat-history';
import { systemPrompt } from '@/lib/prompts';
import { hierarchicalSearch } from '@/lib/vector-store';
import { getSettings } from '@/lib/settings';
import { StreamData } from 'ai';
import { Ollama } from 'ollama'; // Use native client directly
import fs from 'fs';
import path from 'path';
import { CONFIG } from '@/lib/config';

// Allow streaming responses up to 5 minutes
export const maxDuration = 300;

// Timeout for title generation (10 seconds)
const TITLE_GENERATION_TIMEOUT = 30000;

interface Source {
    [key: string]: string | number;
    id: string;
    text: string;
    similarity: number;
}

async function generateTitle(aiResponse: string, settings: ReturnType<typeof getSettings>): Promise<string> {
    try {
        const ollama = new Ollama({ host: settings.ollamaHost });
        const responsePreview = aiResponse.substring(0, 300);

        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Title generation timeout')), TITLE_GENERATION_TIMEOUT);
        });

        const generatePromise = ollama.chat({
            model: settings.chatModel,
            messages: [
                { role: 'user', content: `Generate a very short, concise title (max 4 words) for a chat based on this AI response: "${responsePreview}". Do not use quotes. Just the title, nothing else.` }
            ],
            stream: false
        });

        // @ts-ignore
        const response = await Promise.race([generatePromise, timeoutPromise]);
        // @ts-ignore
        return response.message.content.trim().substring(0, 20);
    } catch (error) {
        console.error('Error generating title:', error);
        return 'New Chat';
    }
}

export async function POST(req: Request) {
    let session: ChatSession | null = null;

    try {
        const { messages, sessionId, personaId, personaPrompt } = await req.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(JSON.stringify({ error: 'Invalid messages' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (sessionId) {
            session = getSession(sessionId);
        }

        if (!session) {
            const newId = sessionId || Date.now().toString();
            session = createSession(newId);
        }

        // Save user message
        const lastMessage = messages[messages.length - 1];
        session.messages.push(lastMessage);
        saveSession(session);

        // Context retrieval with error handling
        let context = "";
        let sources: Source[] = [];
        let ragStatus = { searched: false, found: 0, error: null as string | null };

        try {
            const searchResult = await hierarchicalSearch(lastMessage.content);
            ragStatus.searched = true;

            if (searchResult.bestDocument) {
                context += `Best Matching Document:\n${searchResult.bestDocument.original_text}\n\n`;
                sources.push({
                    id: searchResult.bestDocument.id,
                    text: searchResult.bestDocument.original_text,
                    similarity: searchResult.bestDocument.score
                });
            }

            if (searchResult.topChunks.length > 0) {
                context += `Relevant Context from Vault:\n`;
                searchResult.topChunks.forEach((chunk) => {
                    const sourceFile = chunk.source || 'unknown';
                    context += `--- From "${sourceFile}" ---\n${chunk.original_text}\n\n`;
                    sources.push({
                        id: chunk.id,
                        text: chunk.original_text,
                        similarity: chunk.score,
                        source: sourceFile
                    });
                });
            }

            ragStatus.found = sources.length;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            ragStatus.error = errorMsg;
            console.error('RAG Search Error:', errorMsg);
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

        // Validate that we have required settings
        if (!settings.ollamaHost || !settings.chatModel) {
            return new Response(JSON.stringify({
                error: 'Ollama not configured. Please check settings.'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }


        // Build system prompt: persona + RAG context
        let finalPrompt: string;

        if (personaPrompt) {
            // Persona-based conversation: combine persona prompt with RAG context
            finalPrompt = `${personaPrompt}\n\n---\n\n## Retrieved Knowledge Context\n${context || 'No specific context retrieved for this query.'}\n\n---\n\nRemember to stay in character while using the above context to inform your response.`;
        } else {
            // Default RAG prompt
            finalPrompt = systemPrompt(context);
        }

        const ollamaClient = new Ollama({ host: settings.ollamaHost });
        const encoder = new TextEncoder();

        // UNIFIED NATIVE HANDLER
        const stream = new ReadableStream({
            async start(controller) {
                // Helper for safe enqueuing
                const safeEnqueue = (chunk: Uint8Array) => {
                    try {
                        controller.enqueue(chunk);
                    } catch (e) {
                        // Ignore if controller is closed
                    }
                };

                // Send initial data (sources)
                try {
                    // Format: 2:JSON\n (Data protocol)
                    const dataPayload = JSON.stringify([{
                        sources,
                        ragStatus
                    }]);
                    safeEnqueue(encoder.encode(`2:${dataPayload}\n`));
                } catch (e) {
                    console.error('Error sending stream data:', e);
                }

                let fullText = '';
                let fullThinking = '';
                let wasThinking = false;
                let sentThinkingOpen = false;

                try {

                    const response = await ollamaClient.chat({
                        model: settings.chatModel,
                        messages: [
                            { role: 'system', content: finalPrompt },
                            ...messages.map((m: any) => ({ role: m.role, content: m.content }))
                        ],
                        stream: true,
                        keep_alive: '30m', // Keep model loaded in memory to reduce TTFT
                    });

                    let chunkIndex = 0;
                    for await (const part of response) {
                        chunkIndex++;


                        // Handle thinking tokens (from thinking models like qwen3, deepseek-r1)
                        const thinking = (part.message as any).thinking;
                        if (thinking) {
                            wasThinking = true;
                            // Send opening tag on first thinking token
                            if (!sentThinkingOpen) {
                                safeEnqueue(encoder.encode(`0:${JSON.stringify('<think>')}\n`));
                                sentThinkingOpen = true;
                            }
                            // Send thinking content as regular text
                            safeEnqueue(encoder.encode(`0:${JSON.stringify(thinking)}\n`));
                            fullThinking += thinking;
                        }

                        const content = part.message.content;
                        if (content) {
                            // If we were thinking and now have content, close thinking tag
                            if (wasThinking && sentThinkingOpen) {
                                safeEnqueue(encoder.encode(`0:${JSON.stringify('</think>')}\n`));
                                wasThinking = false;
                            }
                            // Send content as regular text
                            safeEnqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
                            fullText += content;
                        }
                    }
                } catch (err) {
                    console.error('Ollama stream error:', err);
                    safeEnqueue(encoder.encode(`0:${JSON.stringify(`\n\nError: ${err}\n`)}\n`));
                } finally {
                    try {
                        controller.close();
                    } catch (e) {
                        // Ignore if already closed
                    }

                    // Save session complete
                    if (session) {
                        session.messages.push({
                            id: Date.now().toString(),
                            role: 'assistant',
                            content: fullText || '...',
                            annotations: [{ type: 'sources', sources }]
                        });
                        saveSession(session);

                        // Generate title after first AI response
                        const userMessageCount = session.messages.filter(m => m.role === 'user').length;
                        if (userMessageCount === 1 && fullText) {
                            generateTitle(fullText, settings).then(title => {
                                if (session) {
                                    session.title = title;
                                    saveSession(session);
                                }
                            }).catch(console.error);
                        }
                    }
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Session-Id': session.id
            }
        });

    } catch (error) {
        console.error('Chat error:', error);

        // Determine error type and provide helpful message
        let errorMessage = 'Error generating response';
        let statusCode = 500;

        if (error instanceof Error) {
            if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
                errorMessage = 'Cannot connect to Ollama. Please ensure Ollama is running.';
                statusCode = 503;
            } else if (error.message.includes('model')) {
                errorMessage = 'Model not found. Please check your settings.';
                statusCode = 400;
            } else if (error.message.includes('vector column') || error.message.includes('dimension')) {
                errorMessage = 'Embedding dimension mismatch. Please go to Settings and click "Re-index Vault" to fix this.';
                statusCode = 400;
            } else {
                errorMessage = error.message;
            }
        }

        return new Response(JSON.stringify({ error: errorMessage }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
