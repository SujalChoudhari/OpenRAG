import fs from 'fs';
import path from 'path';
import { CONFIG } from './config';

const PERSONAS_DIR = path.join(CONFIG.DATA_DIR, 'personas');

/**
 * Persona Definition Schema
 * Defines how an AI presents itself - voice, behavior, constraints
 */
export interface Persona {
    id: string;
    name: string;
    avatar?: string; // Emoji or initial
    createdAt: number;
    updatedAt: number;

    // Core Definition
    role: string; // e.g., "tutor", "coach", "analyst", "character"
    description: string; // Brief description of who this persona is

    // Behavioral Configuration
    tone: PersonaTone;
    style: PersonaStyle;

    // Knowledge & Context
    knowledgeBoundaries: string[]; // Topics the persona knows about
    contextSources: string[]; // File paths or vault references

    // Constraints & Rules
    constraints: string[]; // Things the persona should NOT do
    objectives: string[]; // Goals and priorities

    // Examples for few-shot learning
    exampleInteractions: ExampleInteraction[];

    // Generated System Prompt (cached)
    systemPrompt: string;

    // Metadata
    isDefault?: boolean;
    sourceFiles?: string[]; // Files used to generate this persona
}

export interface PersonaTone {
    formality: 'casual' | 'neutral' | 'formal' | 'professional';
    warmth: 'cold' | 'neutral' | 'warm' | 'enthusiastic';
    directness: 'indirect' | 'balanced' | 'direct' | 'blunt';
    verbosity: 'concise' | 'balanced' | 'detailed' | 'verbose';
}

export interface PersonaStyle {
    useEmoji: boolean;
    useMarkdown: boolean;
    useCodeBlocks: boolean;
    responseLength: 'short' | 'medium' | 'long' | 'adaptive';
}

export interface ExampleInteraction {
    user: string;
    assistant: string;
}

// Default tone and style
const DEFAULT_TONE: PersonaTone = {
    formality: 'neutral',
    warmth: 'warm',
    directness: 'balanced',
    verbosity: 'balanced'
};

const DEFAULT_STYLE: PersonaStyle = {
    useEmoji: false,
    useMarkdown: true,
    useCodeBlocks: true,
    responseLength: 'adaptive'
};

// Ensure directory exists
function ensurePersonasDir(): void {
    if (!fs.existsSync(PERSONAS_DIR)) {
        fs.mkdirSync(PERSONAS_DIR, { recursive: true });
    }
}

// Initialize on module load
ensurePersonasDir();

/**
 * Generate a system prompt from persona definition
 */
export function generateSystemPrompt(persona: Persona): string {
    const toneDescriptions = {
        formality: {
            casual: 'Use casual, conversational language',
            neutral: 'Use neutral, balanced language',
            formal: 'Use formal, polished language',
            professional: 'Use strictly professional language'
        },
        warmth: {
            cold: 'Be matter-of-fact and detached',
            neutral: 'Be neutral in emotional expression',
            warm: 'Be warm and friendly',
            enthusiastic: 'Be enthusiastic and encouraging'
        },
        directness: {
            indirect: 'Be subtle and diplomatic',
            balanced: 'Balance directness with tact',
            direct: 'Be clear and straightforward',
            blunt: 'Be very direct, even blunt'
        },
        verbosity: {
            concise: 'Keep responses brief and to the point',
            balanced: 'Provide balanced, moderate-length responses',
            detailed: 'Provide thorough, detailed responses',
            verbose: 'Provide comprehensive, extensive responses'
        }
    };

    let prompt = `You are ${persona.name}.\n\n`;
    prompt += `## Role\n${persona.role}\n\n`;
    prompt += `## Description\n${persona.description}\n\n`;

    // Tone
    prompt += `## Communication Style\n`;
    prompt += `- ${toneDescriptions.formality[persona.tone.formality]}\n`;
    prompt += `- ${toneDescriptions.warmth[persona.tone.warmth]}\n`;
    prompt += `- ${toneDescriptions.directness[persona.tone.directness]}\n`;
    prompt += `- ${toneDescriptions.verbosity[persona.tone.verbosity]}\n`;

    if (persona.style.useEmoji) prompt += `- Feel free to use emoji when appropriate\n`;
    if (persona.style.useMarkdown) prompt += `- Use markdown formatting\n`;
    if (persona.style.useCodeBlocks) prompt += `- Use code blocks for code\n`;
    prompt += `\n`;

    // Objectives
    if (persona.objectives.length > 0) {
        prompt += `## Objectives\n`;
        persona.objectives.forEach(obj => {
            prompt += `- ${obj}\n`;
        });
        prompt += `\n`;
    }

    // Knowledge boundaries
    if (persona.knowledgeBoundaries.length > 0) {
        prompt += `## Areas of Expertise\n`;
        persona.knowledgeBoundaries.forEach(topic => {
            prompt += `- ${topic}\n`;
        });
        prompt += `\n`;
    }

    // Constraints
    if (persona.constraints.length > 0) {
        prompt += `## Constraints (DO NOT)\n`;
        persona.constraints.forEach(constraint => {
            prompt += `- ${constraint}\n`;
        });
        prompt += `\n`;
    }

    // Example interactions (few-shot)
    if (persona.exampleInteractions.length > 0) {
        prompt += `## Example Interactions\n`;
        persona.exampleInteractions.forEach((ex, i) => {
            prompt += `\nExample ${i + 1}:\nUser: ${ex.user}\nAssistant: ${ex.assistant}\n`;
        });
        prompt += `\n`;
    }

    prompt += `Stay in character and maintain this persona throughout the conversation.`;

    return prompt;
}

/**
 * Create a new persona
 */
export function createPersona(data: Partial<Persona>): Persona {
    ensurePersonasDir();

    const id = data.id || `persona_${Date.now()}`;
    const now = Date.now();

    const persona: Persona = {
        id,
        name: data.name || 'New Persona',
        avatar: data.avatar || '🤖',
        createdAt: now,
        updatedAt: now,
        role: data.role || 'assistant',
        description: data.description || '',
        tone: data.tone || { ...DEFAULT_TONE },
        style: data.style || { ...DEFAULT_STYLE },
        knowledgeBoundaries: data.knowledgeBoundaries || [],
        contextSources: data.contextSources || [],
        constraints: data.constraints || [],
        objectives: data.objectives || [],
        exampleInteractions: data.exampleInteractions || [],
        systemPrompt: '',
        isDefault: data.isDefault || false,
        sourceFiles: data.sourceFiles || []
    };

    // Generate system prompt
    persona.systemPrompt = generateSystemPrompt(persona);

    savePersona(persona);
    return persona;
}

/**
 * Get a persona by ID
 */
export function getPersona(id: string): Persona | null {
    const filePath = path.join(PERSONAS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading persona ${id}:`, error);
        return null;
    }
}

/**
 * Save a persona
 */
export function savePersona(persona: Persona): void {
    ensurePersonasDir();
    persona.updatedAt = Date.now();
    // Regenerate system prompt on save
    persona.systemPrompt = generateSystemPrompt(persona);
    const filePath = path.join(PERSONAS_DIR, `${persona.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(persona, null, 2));
}

/**
 * Get all personas
 */
export function getAllPersonas(): Persona[] {
    try {
        ensurePersonasDir();
        const files = fs.readdirSync(PERSONAS_DIR).filter(f => f.endsWith('.json'));
        return files.map(file => {
            try {
                const data = fs.readFileSync(path.join(PERSONAS_DIR, file), 'utf-8');
                return JSON.parse(data);
            } catch {
                return null;
            }
        }).filter((p): p is Persona => p !== null)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
        console.error('Error getting all personas:', error);
        return [];
    }
}

/**
 * Delete a persona
 */
export function deletePersona(id: string): boolean {
    const filePath = path.join(PERSONAS_DIR, `${id}.json`);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error deleting persona ${id}:`, error);
        return false;
    }
}

/**
 * Get default persona
 */
export function getDefaultPersona(): Persona | null {
    const personas = getAllPersonas();
    return personas.find(p => p.isDefault) || personas[0] || null;
}

/**
 * Set a persona as default
 */
export function setDefaultPersona(id: string): void {
    const personas = getAllPersonas();
    personas.forEach(p => {
        p.isDefault = p.id === id;
        savePersona(p);
    });
}

/**
 * Create the default personas for OpenRAG
 * Three personas with distinct purposes for interacting with your knowledge base
 */
export function createDefaultPersonas(): void {
    const existing = getAllPersonas();
    if (existing.length > 0) return;

    // 1. OpenRAG Assistant - General purpose knowledge retrieval
    createPersona({
        id: 'default_assistant',
        name: 'OpenRAG Assistant',
        avatar: '🧠',
        role: 'Your personal knowledge assistant',
        description: 'I help you understand, synthesize, and recall information from your personal knowledge base. I analyze your notes, find connections, and answer questions based on your collected knowledge.',
        tone: {
            formality: 'neutral',
            warmth: 'warm',
            directness: 'direct',
            verbosity: 'balanced'
        },
        style: {
            useEmoji: false,
            useMarkdown: true,
            useCodeBlocks: true,
            responseLength: 'adaptive'
        },
        objectives: [
            'Help user recall and understand their personal knowledge',
            'Find connections between different pieces of information',
            'Provide accurate, well-cited answers from the knowledge base',
            'Suggest related topics and follow-up questions'
        ],
        constraints: [
            'Do not make up information not in the knowledge base',
            'Do not pretend to be a specific person',
            'Always cite sources when making claims'
        ],
        knowledgeBoundaries: ['Personal notes', 'Life events', 'Relationships', 'Projects'],
        exampleInteractions: [
            {
                user: 'What do I know about project X?',
                assistant: 'Based on your notes, Project X was started in March 2023... [Source: 1]'
            }
        ],
        isDefault: true
    });

    // 2. Knowledge Explorer - Discovery and connections
    createPersona({
        id: 'knowledge_explorer',
        name: 'Knowledge Explorer',
        avatar: '🔮',
        role: 'Discovery guide for hidden connections',
        description: 'I specialize in finding unexpected connections, patterns, and insights within your knowledge base. I help you discover relationships between ideas you might have missed and surface forgotten gems from your notes.',
        tone: {
            formality: 'casual',
            warmth: 'enthusiastic',
            directness: 'balanced',
            verbosity: 'detailed'
        },
        style: {
            useEmoji: true,
            useMarkdown: true,
            useCodeBlocks: false,
            responseLength: 'medium'
        },
        objectives: [
            'Discover hidden connections between disparate notes',
            'Surface forgotten but relevant information',
            'Identify patterns and themes across your knowledge',
            'Inspire new ideas by connecting dots',
            'Help you see your knowledge from new angles'
        ],
        constraints: [
            'Focus on discovery, not just retrieval',
            'Highlight surprising or non-obvious connections',
            'Encourage exploration rather than definitive answers'
        ],
        knowledgeBoundaries: ['Ideas', 'Patterns', 'Connections', 'Creative insights'],
        exampleInteractions: [
            {
                user: 'What connects my recent notes?',
                assistant: '✨ Interesting! I found a thread connecting three of your recent entries - your note about productivity links to your journal entry about morning routines, which also relates to that book summary you made...'
            }
        ],
        isDefault: false
    });

    // 3. Research Analyst - Deep analysis and synthesis
    createPersona({
        id: 'research_analyst',
        name: 'Research Analyst',
        avatar: '📊',
        role: 'Deep research and analytical synthesis',
        description: 'I provide rigorous, structured analysis of your knowledge base. I help with research projects, comparative analysis, and creating comprehensive summaries with proper citations and evidence-based conclusions.',
        tone: {
            formality: 'professional',
            warmth: 'neutral',
            directness: 'direct',
            verbosity: 'detailed'
        },
        style: {
            useEmoji: false,
            useMarkdown: true,
            useCodeBlocks: true,
            responseLength: 'long'
        },
        objectives: [
            'Provide structured, well-organized analysis',
            'Compare and contrast information from multiple sources',
            'Identify gaps in existing knowledge',
            'Create comprehensive summaries with citations',
            'Evaluate evidence strength and reliability',
            'Support research and writing projects'
        ],
        constraints: [
            'Always provide citations for claims',
            'Distinguish between facts and interpretations',
            'Note when information is incomplete or contradictory',
            'Maintain academic rigor in analysis'
        ],
        knowledgeBoundaries: ['Research', 'Analysis', 'Synthesis', 'Academic writing'],
        exampleInteractions: [
            {
                user: 'Summarize everything I know about topic Y',
                assistant: '## Summary: Topic Y\n\n### Overview\nBased on 7 sources in your knowledge base...\n\n### Key Findings\n1. **Finding A** - [Source: 1, 3]\n2. **Finding B** - [Source: 2, 5]\n\n### Gaps Identified\n- No information about...\n\n### Recommendations\n...'
            }
        ],
        isDefault: false
    });
}

