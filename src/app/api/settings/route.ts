import { getSettings, saveSettings } from '@/lib/settings';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    const settings = getSettings();
    return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
    try {
        const newSettings = await req.json();
        saveSettings(newSettings);
        return NextResponse.json({ success: true, settings: newSettings });
    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 });
    }
}
