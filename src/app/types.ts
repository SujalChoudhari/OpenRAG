// types.ts
export interface Message {
    role: 'user' | 'ai';
    content: string;
}