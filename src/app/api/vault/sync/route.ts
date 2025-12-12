import { VaultWatcher } from '@/lib/vault-watcher';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // Allow 5 minutes for sync

/**
 * GET /api/vault/sync?checkOnly=true
 * Check for vault changes without syncing
 */
export async function GET(req: NextRequest) {
    try {
        const checkOnly = req.nextUrl.searchParams.get('checkOnly') === 'true';
        const watcher = new VaultWatcher();

        if (checkOnly) {
            const changes = watcher.checkOnly();
            const hasChanges = changes.newFiles.length > 0 ||
                changes.modifiedFiles.length > 0 ||
                changes.deletedFiles.length > 0;

            return NextResponse.json({
                success: true,
                hasChanges,
                changes
            });
        }

        // Default: just return check results
        const changes = watcher.checkOnly();
        return NextResponse.json({
            success: true,
            changes
        });
    } catch (error) {
        console.error('Vault check failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

/**
 * POST /api/vault/sync
 * Perform full sync (index changed files)
 */
export async function POST(_req: NextRequest) {
    try {
        const watcher = new VaultWatcher();
        const stats = await watcher.checkAndSync();

        return NextResponse.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Vault sync failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
