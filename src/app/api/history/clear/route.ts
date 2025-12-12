import { clearAllSessions } from '@/lib/chat-history';
import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/app/types';

export async function DELETE() {
    const success = clearAllSessions();
    return NextResponse.json<ApiResponse>({ success });
}

