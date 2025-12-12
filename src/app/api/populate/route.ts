import { DocumentProcessor } from "@/lib/document-processor";
import { storeDocument } from "@/lib/vector-store";
import { CONFIG } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";


export async function POST(request: NextRequest) {
    const { text, id } = await request.json();
    // storing as a document with generic metadata
    await storeDocument(id, 'api_upload', text.substring(0, 50) + '...', text, 'api');
    return NextResponse.json({ message: 'Embedding stored successfully' });
}

export async function GET(request: NextRequest) {
    const docProcessor = new DocumentProcessor(CONFIG.DATA_DIR);
    docProcessor.loadDocuments();
    return NextResponse.json({ message: 'Embeddings loaded successfully' });
}