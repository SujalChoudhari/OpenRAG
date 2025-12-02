import { getAllSessions } from '@/lib/chat-history';
import { NextResponse } from 'next/server';

export async function GET() {
    const sessions = getAllSessions();
    return NextResponse.json({ sessions });
}
