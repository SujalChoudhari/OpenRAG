import { getSession } from '@/lib/chat-history';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const session = getSession(params.id);
    if (!session) {
        return new NextResponse('Session not found', { status: 404 });
    }
    return NextResponse.json(session);
}
