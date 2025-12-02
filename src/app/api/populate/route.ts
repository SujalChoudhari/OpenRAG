import { DocumentProcessor } from "@/lib/document-processor";
import { storeEmbedding } from "@/lib/vector-store";
import { CONFIG } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";


export async function POST(request: NextRequest) {
    const { text, id } = await request.json();
    await storeEmbedding(text, id);
    return NextResponse.json({ message: 'Embedding stored successfully' });
}

export async function GET(request: NextRequest) {
    const docProcessor = new DocumentProcessor(CONFIG.DATA_DIR);
    docProcessor.loadDocuments();
    return NextResponse.json({ message: 'Embeddings loaded successfully' });
}