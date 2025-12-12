import { VaultIngestor } from '@/lib/ingest';
import { getSettings } from '@/lib/settings';
import { clearDatabase } from '@/lib/vector-store';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large vaults

/**
 * POST /api/vault/ingest
 * Stream ingestion progress via Server-Sent Events
 */
export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                const settings = getSettings();

                if (!settings.vaultPath) {
                    send({ type: 'error', message: 'Vault path not configured' });
                    controller.close();
                    return;
                }

                const ingestor = new VaultIngestor();
                const files = ingestor.getMarkdownFiles(settings.vaultPath);

                send({ type: 'start', total: files.length, vaultPath: settings.vaultPath });
                console.log(`\n📚 Starting ingestion of ${files.length} files from ${settings.vaultPath}`);

                // Clear existing data first
                send({ type: 'status', message: 'Clearing existing index...' });
                await clearDatabase();

                let indexed = 0;
                let errors = 0;

                for (const file of files) {
                    const fileName = file.replace(settings.vaultPath, '').replace(/^[\\\/]/, '');
                    send({
                        type: 'progress',
                        current: indexed + 1,
                        total: files.length,
                        file: fileName,
                        percent: Math.round(((indexed + 1) / files.length) * 100)
                    });

                    try {
                        await ingestor.processFile(file);
                        indexed++;
                        console.log(`   ✅ [${indexed}/${files.length}] ${fileName}`);
                    } catch (error) {
                        errors++;
                        console.error(`   ❌ Failed: ${fileName}`, error);
                        send({ type: 'file_error', file: fileName, error: String(error) });
                    }
                }

                send({
                    type: 'complete',
                    indexed,
                    errors,
                    message: `Successfully indexed ${indexed} files${errors > 0 ? ` (${errors} errors)` : ''}`
                });
                console.log(`\n✅ Ingestion complete: ${indexed} files indexed, ${errors} errors\n`);

            } catch (error) {
                console.error('Ingestion error:', error);
                send({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
