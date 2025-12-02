import { NextRequest, NextResponse } from 'next/server';
import { CONFIG } from '@/lib/config';
import { DocumentProcessor } from '@/lib/document-processor';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

export async function POST(req: NextRequest) {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
        return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendLog = (msg: string) => {
                controller.enqueue(encoder.encode(msg + '\n'));
            };

            try {
                if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
                    fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
                }

                const docProcessor = new DocumentProcessor(CONFIG.DATA_DIR);

                for (const file of files) {
                    const buffer = Buffer.from(await file.arrayBuffer());
                    const filePath = path.join(CONFIG.UPLOAD_DIR, file.name);

                    sendLog(`Saving ${file.name}...`);
                    await writeFile(filePath, new Uint8Array(buffer));

                    await docProcessor.processFile(filePath, (msg) => {
                        sendLog(msg);
                    });
                }
                sendLog('All files processed successfully.');
                controller.close();
            } catch (error) {
                console.error('Upload error:', error);
                sendLog(`Error: ${error}`);
                controller.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
        },
    });
}
