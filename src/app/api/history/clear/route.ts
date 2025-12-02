import { getAllSessions, deleteSession } from '@/lib/chat-history';
import { NextResponse } from 'next/server';

export async function DELETE() {
    const sessions = getAllSessions();
    sessions.forEach(session => {
        deleteSession(session.id);
    });
    return NextResponse.json({ success: true });
}
