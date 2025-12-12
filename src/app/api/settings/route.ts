import { getSettings, saveSettings, getDefaultSettings, validateSettings } from '@/lib/settings';
import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, Settings } from '@/app/types';

export async function GET() {
    try {
        const settings = getSettings();
        return NextResponse.json<ApiResponse<Settings>>({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Error reading settings:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Failed to read settings'
        }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Validate the incoming settings
        if (!validateSettings(body)) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Invalid settings format. Please check all fields are filled correctly.'
            }, { status: 400 });
        }

        const result = saveSettings(body);

        if (!result.success) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: result.error || 'Failed to save settings'
            }, { status: 400 });
        }

        return NextResponse.json<ApiResponse<Settings>>({
            success: true,
            data: body
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        const message = error instanceof Error ? error.message : 'Failed to update settings';
        return NextResponse.json<ApiResponse>({
            success: false,
            error: message
        }, { status: 500 });
    }
}

// Get default settings
export async function PUT() {
    return NextResponse.json<ApiResponse<Settings>>({
        success: true,
        data: getDefaultSettings()
    });
}
