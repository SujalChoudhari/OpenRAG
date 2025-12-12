import { VaultIngestor } from '@/lib/ingest';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getSettings } from '@/lib/settings';

export async function GET(_req: NextRequest) {
    try {
        const ingestor = new VaultIngestor();
        const settings = getSettings();

        // Use the public method we verified earlier
        const files = ingestor.getMarkdownFiles(settings.vaultPath);

        // Convert to relative paths for cleaner UI
        const relativeFiles = files.map(f => ({
            id: path.relative(settings.vaultPath, f),
            path: path.relative(settings.vaultPath, f),
            name: path.basename(f, '.md'),
            absolutePath: f
        }));

        return NextResponse.json({
            success: true,
            files: relativeFiles
        });
    } catch (error) {
        console.error('Failed to list vault files:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
