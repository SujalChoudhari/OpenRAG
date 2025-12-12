import { createPersona, Persona, PersonaTone, PersonaStyle } from '@/lib/personas';
import { getSettings } from '@/lib/settings';
import { hierarchicalSearch } from '@/lib/vector-store';
import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createOllama } from 'ollama-ai-provider';
import type { ApiResponse } from '@/app/types';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '@/lib/config';

export const maxDuration = 120; // Allow 2 minutes for generation

interface GenerateRequest {
    name: string;
    description?: string;
    role?: string;

    // Source options
    vaultQuery?: string; // Search query to find relevant vault files
    fileNames?: string[]; // Specific uploaded files to use
    customContext?: string; // Custom text to base persona on

    // Optional hints
    toneHints?: Partial<PersonaTone>;
    styleHints?: Partial<PersonaStyle>;
}

/**
 * POST /api/personas/generate
 * Generate a persona using AI from files, vault content, or custom context
 */
export async function POST(req: NextRequest) {
    try {
        const body: GenerateRequest = await req.json();

        if (!body.name) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Name is required'
            }, { status: 400 });
        }

        const settings = getSettings();

        if (!settings.ollamaHost || !settings.chatModel) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Ollama not configured. Please check settings.'
            }, { status: 500 });
        }

        // Gather context from various sources
        let context = '';
        const sourceFiles: string[] = [];

        // 1. From vault (via search)
        if (body.vaultQuery) {
            const searchResult = await hierarchicalSearch(body.vaultQuery);
            if (searchResult.bestDocument) {
                context += `\n--- From Vault (Best Match) ---\n${searchResult.bestDocument.original_text}\n`;
            }
            searchResult.topChunks.forEach((chunk, i) => {
                context += `\n--- Vault Chunk ${i + 1} ---\n${chunk.original_text}\n`;
                sourceFiles.push(chunk.source);
            });
        }

        // 2. From specific vault files
        if (body.fileNames && body.fileNames.length > 0) {
            console.log('📂 Reading vault files for persona:', body.fileNames);
            for (const fileName of body.fileNames) {
                // Files are relative paths from the vault
                const filePath = path.join(settings.vaultPath, fileName);
                console.log(`   📄 Attempting to read: ${filePath}`);
                if (fs.existsSync(filePath)) {
                    try {
                        const content = fs.readFileSync(filePath, 'utf-8');
                        context += `\n--- File: ${fileName} ---\n${content.substring(0, 5000)}\n`;
                        sourceFiles.push(fileName);
                        console.log(`   ✅ Successfully read ${fileName} (${content.length} chars)`);
                    } catch (err) {
                        console.error(`   ❌ Error reading file ${fileName}:`, err);
                    }
                }
            }
        }

        // 3. Custom context
        if (body.customContext) {
            context += `\n--- Custom Context ---\n${body.customContext}\n`;
        }

        // Generate persona using AI
        const ollama = createOllama({ baseURL: settings.ollamaHost + '/api' });

        const generationPrompt = `You are a persona designer. Based on the following context, create a detailed persona definition for someone named "${body.name}".
${body.description ? `Description hint: ${body.description}` : ''}
${body.role ? `Role hint: ${body.role}` : ''}

Context about this persona:
${context || 'No specific context provided. Create a general helpful assistant persona.'}

Generate a JSON object with these fields:
{
  "role": "A one-line description of the persona's role",
  "description": "2-3 sentences describing who this persona is and their background",
  "objectives": ["Goal 1", "Goal 2", "Goal 3"],
  "constraints": ["What they should NOT do 1", "What they should NOT do 2"],
  "knowledgeBoundaries": ["Topic they know about 1", "Topic 2", "Topic 3"],
  "exampleInteractions": [
    {"user": "Example user question", "assistant": "How the persona would respond"}
  ],
  "tone": {
    "formality": "casual|neutral|formal|professional",
    "warmth": "cold|neutral|warm|enthusiastic",
    "directness": "indirect|balanced|direct|blunt",
    "verbosity": "concise|balanced|detailed|verbose"
  }
}

Important:
- Base the persona on the provided context
- Make the persona feel authentic and consistent
- Include specific knowledge from the context
- Output ONLY valid JSON, no other text`;

        const { text: generatedJson } = await generateText({
            model: ollama(settings.chatModel),
            prompt: generationPrompt,
        });

        // Parse the generated JSON
        let generatedData: Partial<Persona>;
        try {
            // Try to extract JSON from the response
            const jsonMatch = generatedJson.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            generatedData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            console.error('Failed to parse generated persona:', parseError);
            console.error('Raw response:', generatedJson);

            // Fallback: create a basic persona
            generatedData = {
                role: body.role || 'Assistant',
                description: body.description || `A persona based on ${body.name}`,
                objectives: ['Help the user', 'Provide accurate information'],
                constraints: ['Do not make up information'],
                knowledgeBoundaries: [],
            };
        }

        // Merge with hints
        const persona = createPersona({
            name: body.name,
            avatar: getAvatarForRole(generatedData.role || 'assistant'),
            role: generatedData.role || 'Assistant',
            description: generatedData.description || '',
            objectives: generatedData.objectives || [],
            constraints: generatedData.constraints || [],
            knowledgeBoundaries: generatedData.knowledgeBoundaries || [],
            exampleInteractions: generatedData.exampleInteractions || [],
            tone: {
                formality: generatedData.tone?.formality || body.toneHints?.formality || 'neutral',
                warmth: generatedData.tone?.warmth || body.toneHints?.warmth || 'warm',
                directness: generatedData.tone?.directness || body.toneHints?.directness || 'balanced',
                verbosity: generatedData.tone?.verbosity || body.toneHints?.verbosity || 'balanced',
            },
            style: {
                useEmoji: body.styleHints?.useEmoji ?? false,
                useMarkdown: body.styleHints?.useMarkdown ?? true,
                useCodeBlocks: body.styleHints?.useCodeBlocks ?? true,
                responseLength: body.styleHints?.responseLength || 'adaptive',
            },
            sourceFiles: Array.from(new Set(sourceFiles)),
        });

        return NextResponse.json<ApiResponse<Persona>>({
            success: true,
            data: persona
        });

    } catch (error) {
        console.error('Error generating persona:', error);
        const message = error instanceof Error ? error.message : 'Failed to generate persona';
        return NextResponse.json<ApiResponse>({
            success: false,
            error: message
        }, { status: 500 });
    }
}

function getAvatarForRole(role: string): string {
    const roleLower = role.toLowerCase();
    if (roleLower.includes('analyst') || roleLower.includes('research')) return '🔬';
    if (roleLower.includes('tutor') || roleLower.includes('teacher')) return '📚';
    if (roleLower.includes('coach') || roleLower.includes('mentor')) return '💪';
    if (roleLower.includes('writer') || roleLower.includes('author')) return '✍️';
    if (roleLower.includes('developer') || roleLower.includes('engineer')) return '💻';
    if (roleLower.includes('friend') || roleLower.includes('companion')) return '🤝';
    if (roleLower.includes('assistant')) return '🤖';
    if (roleLower.includes('creative')) return '🎨';
    if (roleLower.includes('therapist') || roleLower.includes('counselor')) return '💭';
    return '✨';
}
