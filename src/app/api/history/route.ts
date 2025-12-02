import { getHistoryFiles } from '@/lib/chat-history';
import { NextResponse } from 'next/server';

export async function GET() {
    const files = getHistoryFiles();
    return NextResponse.json({ files });
}
