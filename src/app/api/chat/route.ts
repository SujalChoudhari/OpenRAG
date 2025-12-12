import { createSession, getSession, saveSession, ChatSession } from '@/lib/chat-history';
import { systemPrompt } from '@/lib/prompts';
import { hierarchicalSearch } from '@/lib/vector-store';
import { getSettings } from '@/lib/settings';
import { convertToCoreMessages, streamText, generateText, StreamData } from 'ai';
import { createOllama } from 'ollama-ai-provider';
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

async function generateTitle(messages: { role: string; content: string }[], settings: ReturnType<typeof getSettings>): Promise<string> {
    try {
        const ollama = createOllama({ baseURL: settings.ollamaHost + '/api' });
        const userMessage = messages.find(m => m.role === 'user')?.content || 'New Chat';

        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Title generation timeout')), TITLE_GENERATION_TIMEOUT);
        });

        const generatePromise = generateText({
            model: ollama(settings.chatModel),
            prompt: `Generate a very short, concise title (max 4 words) for a chat that starts with this message: "${userMessage.substring(0, 200)}". Do not use quotes.`,
        });

        const { text } = await Promise.race([generatePromise, timeoutPromise]);
        return text.trim().substring(0, 50); // Limit title length
    } catch (error) {
        console.error('Error generating title:', error);
        return 'New Chat';
    }
}

export async function POST(req: Request) {
    let session: ChatSession | null = null;
    let streamData: StreamData | null = null;

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

        console.log('\n' + '='.repeat(60));
        console.log('📚 RAG SEARCH - Query:', lastMessage.content.substring(0, 100) + '...');
        console.log('='.repeat(60));

        try {
            const searchResult = await hierarchicalSearch(lastMessage.content);
            ragStatus.searched = true;

            console.log('🔍 Search completed successfully');
            console.log(`   Best Document: ${searchResult.bestDocument ? 'YES' : 'NO'}`);
            console.log(`   Top Chunks: ${searchResult.topChunks.length}`);

            if (searchResult.bestDocument) {
                console.log(`   📄 Best Match ID: ${searchResult.bestDocument.id}`);
                console.log(`   📊 Similarity: ${(searchResult.bestDocument.score * 100).toFixed(1)}%`);
                console.log(`   📝 Preview: ${searchResult.bestDocument.original_text.substring(0, 100)}...`);

                context += `Best Matching Document:\n${searchResult.bestDocument.original_text}\n\n`;
                sources.push({
                    id: searchResult.bestDocument.id,
                    text: searchResult.bestDocument.original_text,
                    similarity: searchResult.bestDocument.score
                });
            }

            if (searchResult.topChunks.length > 0) {
                context += `Relevant Context from Vault:\n`;
                searchResult.topChunks.forEach((chunk, index) => {
                    const sourceFile = chunk.source || 'unknown';
                    console.log(`   📄 Chunk ${index + 1}: ${sourceFile} (${(chunk.score * 100).toFixed(1)}%)`);
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
            console.log(`\n✅ Total sources found: ${sources.length}`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            ragStatus.error = errorMsg;
            console.error('❌ RAG Search Error:', errorMsg);
            console.error('   Stack:', error);
        }

        console.log('='.repeat(60) + '\n');

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

        const ollama = createOllama({
            baseURL: settings.ollamaHost + '/api',
        });

        // Generate title in background if it's the first user message
        const userMessageCount = session.messages.filter(m => m.role === 'user').length;
        if (userMessageCount === 1 && session) {
            const sessionRef = session;
            generateTitle(messages, settings).then(title => {
                sessionRef.title = title;
                saveSession(sessionRef);
            }).catch(console.error);
        }

        streamData = new StreamData();
        streamData.append({ sources, ragStatus });

        // Build system prompt: persona + RAG context
        let finalPrompt: string;

        if (personaPrompt) {
            // Persona-based conversation: combine persona prompt with RAG context
            finalPrompt = `${personaPrompt}\n\n---\n\n## Retrieved Knowledge Context\n${context || 'No specific context retrieved for this query.'}\n\n---\n\nRemember to stay in character while using the above context to inform your response.`;
        } else if (settings.systemPrompt) {
            // Custom system prompt from settings
            finalPrompt = settings.systemPrompt.replace('${sources}', context);
        } else {
            // Default RAG prompt
            finalPrompt = systemPrompt(context);
        }

        // Detect if this is a reasoning/thinking model
        const isThinkingModel = settings.chatModel.toLowerCase().includes('deepseek') ||
            settings.chatModel.toLowerCase().includes('qwen') ||
            settings.chatModel.toLowerCase().includes('r1');

        console.log(`🧠 Thinking model detected: ${isThinkingModel ? 'YES' : 'NO'} (${settings.chatModel})`);

        // HYBRID HANDLER: Use native Ollama client for thinking models to support 'think: true'
        if (isThinkingModel) {
            const { Ollama } = await import('ollama'); // Dynamic import to avoid build issues if missing
            const ollamaClient = new Ollama({ host: settings.ollamaHost });

            // Initial data stream with retrieved headers
            if (streamData) {
                // We need to manually send the data part first in the stream
                // The AI SDK's toDataStreamResponse handles this, but here we are manual.
                // We'll construct a ReadableStream that matches the Data Stream Protocol.
            }

            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    // Send initial data (sources)
                    if (streamData) {
                        try {
                            // Format: d:{"sources":[...]}\n
                            // We construct the data object manually
                            const dataPayload = JSON.stringify([{
                                sources,
                                ragStatus
                            }]);
                            // Note: AI SDK format for StreamData is roughly JSON list of appended items
                            // But simplify: just send the raw JSON as a data part
                            controller.enqueue(encoder.encode(`2:${dataPayload}\n`));
                        } catch (e) {
                            console.error('Error sending stream data:', e);
                        }
                    }

                    let fullText = '';
                    let isThinking = false;

                    try {
                        const response = await ollamaClient.chat({
                            model: settings.chatModel,
                            messages: [
                                { role: 'system', content: finalPrompt },
                                ...messages.map((m: any) => ({ role: m.role, content: m.content }))
                            ],
                            stream: true,
                            options: {
                                // @ts-ignore - native client supports this
                                think: true
                            }
                        });

                        for await (const part of response) {
                            // Handle thinking content
                            // @ts-ignore
                            const thinkChunk = part.message?.thinking;
                            // @ts-ignore
                            const contentChunk = part.message?.content;

                            if (thinkChunk) {
                                if (!isThinking) {
                                    controller.enqueue(encoder.encode(`0:<think>`));
                                    isThinking = true;
                                }
                                controller.enqueue(encoder.encode(`0:${thinkChunk}`));
                            }

                            if (contentChunk) {
                                if (isThinking) {
                                    controller.enqueue(encoder.encode(`0:</think>`));
                                    isThinking = false;
                                }
                                controller.enqueue(encoder.encode(`0:${contentChunk}`));
                                fullText += contentChunk;
                            }
                        }

                        // Ensure thinking is closed if stream ends while thinking
                        if (isThinking) {
                            controller.enqueue(encoder.encode(`0:</think>`));
                            isThinking = false;
                        }

                    } catch (err) {
                        console.error('Ollama stream error:', err);
                        controller.enqueue(encoder.encode(`0:\n\nError: ${err}\n`));
                    } finally {
                        if (isThinking) {
                            try { controller.enqueue(encoder.encode(`0:</think>`)); } catch { }
                            isThinking = false;
                        }
                        controller.close();

                        // Save session complete
                        if (session) {
                            session.messages.push({
                                id: Date.now().toString(),
                                role: 'assistant',
                                content: fullText || '...',
                                annotations: [{ type: 'sources', sources }]
                            });
                            saveSession(session);
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

        } else {
            // STANDARD HANDLER (Vercel AI SDK)
            const result = await streamText({
                model: ollama(settings.chatModel),
                system: finalPrompt,
                messages: convertToCoreMessages(messages),
                onFinish: async (completion) => {
                    if (session) {
                        session.messages.push({
                            id: Date.now().toString(),
                            role: 'assistant',
                            content: completion.text,
                            annotations: [{ type: 'sources', sources }]
                        });
                        saveSession(session);
                    }
                    if (streamData) streamData.close();
                }
            });

            return result.toDataStreamResponse({
                data: streamData,
                headers: {
                    'X-Session-Id': session.id
                }
            });
        }
    } catch (error) {
        console.error('Chat error:', error);

        if (streamData) {
            try { streamData.close(); } catch { }
        }

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
