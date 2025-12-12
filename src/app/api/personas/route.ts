import { getAllPersonas, createPersona, createDefaultPersonas } from '@/lib/personas';
import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/app/types';
import type { Persona } from '@/lib/personas';

// GET /api/personas - List all personas
export async function GET() {
    try {
        // Ensure default personas exist
        createDefaultPersonas();

        const personas = getAllPersonas();
        return NextResponse.json<ApiResponse<Persona[]>>({
            success: true,
            data: personas
        });
    } catch (error) {
        console.error('Error fetching personas:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Failed to fetch personas'
        }, { status: 500 });
    }
}

// POST /api/personas - Create a new persona
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!body.name) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Name is required'
            }, { status: 400 });
        }

        const persona = createPersona(body);

        return NextResponse.json<ApiResponse<Persona>>({
            success: true,
            data: persona
        });
    } catch (error) {
        console.error('Error creating persona:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Failed to create persona'
        }, { status: 500 });
    }
}
