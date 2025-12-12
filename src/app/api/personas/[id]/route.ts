import { getPersona, savePersona, deletePersona, setDefaultPersona } from '@/lib/personas';
import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/app/types';
import type { Persona } from '@/lib/personas';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/personas/[id] - Get a specific persona
export async function GET(
    _request: NextRequest,
    { params }: RouteParams
) {
    const { id } = await params;
    const persona = getPersona(id);

    if (!persona) {
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Persona not found'
        }, { status: 404 });
    }

    return NextResponse.json<ApiResponse<Persona>>({
        success: true,
        data: persona
    });
}

// PUT /api/personas/[id] - Update a persona
export async function PUT(
    request: NextRequest,
    { params }: RouteParams
) {
    const { id } = await params;
    const persona = getPersona(id);

    if (!persona) {
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Persona not found'
        }, { status: 404 });
    }

    try {
        const updates = await request.json();

        // Merge updates with existing persona
        const updated: Persona = {
            ...persona,
            ...updates,
            id: persona.id, // Prevent ID change
            createdAt: persona.createdAt, // Preserve creation time
        };

        savePersona(updated);

        // If setting as default
        if (updates.isDefault) {
            setDefaultPersona(id);
        }

        return NextResponse.json<ApiResponse<Persona>>({
            success: true,
            data: getPersona(id)!
        });
    } catch (error) {
        console.error('Error updating persona:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Failed to update persona'
        }, { status: 500 });
    }
}

// DELETE /api/personas/[id] - Delete a persona
export async function DELETE(
    _request: NextRequest,
    { params }: RouteParams
) {
    const { id } = await params;
    const success = deletePersona(id);

    if (!success) {
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Failed to delete persona or persona not found'
        }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true });
}
