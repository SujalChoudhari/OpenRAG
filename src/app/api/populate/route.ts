import { LoadDocuments } from "@/app/utils/loadDocs";
import { storeEmbedding } from "@/app/utils/sqliteEmbeddings";
import { NextRequest, NextResponse } from "next/server";


export async function POST(request: NextRequest) {
    const { text, id } = await request.json();
    await storeEmbedding(text, id);
    return NextResponse.json({ message: 'Embedding stored successfully' });
}

export async function GET(request: NextRequest) {
    const loadDocs = new LoadDocuments('_data');
    loadDocs.loadDocuments();
    return NextResponse.json({ message: 'Embeddings loaded successfully' });
}