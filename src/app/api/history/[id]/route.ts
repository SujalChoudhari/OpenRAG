import { deleteSession } from '@/lib/chat-history';
import { NextResponse } from 'next/server';

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    const id = params.id;
    deleteSession(id);
    return NextResponse.json({ success: true });
}
