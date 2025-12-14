// Unified Message type compatible with AI SDK
export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt?: Date;
    annotations?: MessageAnnotation[];
}

export interface MessageAnnotation {
    type: 'sources';
    sources: Source[];
}

export interface Source {
    id: string;
    text: string;
    similarity: number;
}

// Unified Settings type - used by both frontend and backend
export interface Settings {
    ollamaHost: string;
    embeddingModel: string;
    chatModel: string;
    retrievalDocumentCount: number;
    retrievalChunkCount: number;
    vaultPath: string;
    onboardingCompleted: boolean;
}

// API Response types
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface SessionSummary {
    id: string;
    title: string;
    createdAt: number;
}

export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    messages: Message[];
}

// Search result types
export interface SearchResult {
    id: string;
    text: string;
    score: number;
    metadata: Record<string, unknown>;
    source: string;
    type: 'collection' | 'document' | 'chunk';
}

export interface HierarchicalSearchResult {
    bestDocument: {
        id: string;
        original_text: string;
        score: number;
    } | null;
    topChunks: {
        id: string;
        original_text: string;
        score: number;
        source: string;
    }[];
}