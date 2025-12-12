import { VaultIngestor } from '@/lib/ingest';
import { clearDatabase } from '@/lib/vector-store';

export const maxDuration = 300; // Allow 5 minutes for ingestion

export async function POST(req: Request) {
    try {
        console.log('Starting vault ingestion...');

        // Optional: Clear existing data before full re-index
        await clearDatabase();

        const ingestor = new VaultIngestor();

        // Run ingestion (this might take a while, so we might want to run it without awaiting logic if we want to return early, 
        // but for now let's await to report success/failure)
        await ingestor.scanAndIngest();

        return new Response(JSON.stringify({ success: true, message: 'Ingestion complete' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Ingestion failed:', error);
        return new Response(JSON.stringify({ success: false, error: String(error) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
