import { deleteSession, getSession } from '@/lib/chat-history';
import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, ChatSession } from '@/app/types';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
    _request: NextRequest,
    { params }: RouteParams
) {
    const { id } = await params;
    const session = getSession(id);

    if (!session) {
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Session not found'
        }, { status: 404 });
    }

    return NextResponse.json<ApiResponse<ChatSession>>({
        success: true,
        data: session
    });
}

export async function DELETE(
    _request: NextRequest,
    { params }: RouteParams
) {
    const { id } = await params;
    deleteSession(id);
    return NextResponse.json<ApiResponse>({ success: true });
}
