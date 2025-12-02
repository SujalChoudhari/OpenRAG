import { getSettings } from '@/lib/settings';
import { NextResponse } from 'next/server';
import { Ollama } from 'ollama';

export async function GET() {
    const settings = getSettings();
    const ollama = new Ollama({ host: settings.ollamaHost });

    try {
        const list = await ollama.list();
        return NextResponse.json(list);
    } catch (error) {
        console.error('Error fetching models:', error);
        return NextResponse.json({ models: [] }, { status: 500 });
    }
}
