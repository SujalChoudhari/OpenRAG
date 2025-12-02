export interface Message {
    id?: string;
    role: 'user' | 'assistant' | 'system' | 'data' | 'ai';
    content: string;
    data?: any;
    annotations?: any[];
}