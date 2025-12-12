"use server";

import fs from "fs";
import { DocumentProcessor } from "../lib/document-processor";
import { removeEmbedding } from "../lib/vector-store";
import { CONFIG } from "../lib/config";

// get file list function not dirs
export async function getFiles() {
    if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
        fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
    }
    const files = fs.readdirSync(CONFIG.UPLOAD_DIR);
    return files;
}

// delete file function
export async function removeFile(fileName: string) {
    fs.unlinkSync(`${CONFIG.UPLOAD_DIR}/${fileName}`);
    removeEmbedding(fileName);
}


export type UploadedFile = {
    name: string;
    content: string;
}
// add file function
export async function addContent(files: UploadedFile[]) {
    if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
        fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
    }
    const fileArr = Array.from(files);
    for (const file of fileArr) {
        fs.writeFileSync(`${CONFIG.UPLOAD_DIR}/${file.name}`, file.content);
    }

    const docProcessor = new DocumentProcessor(CONFIG.DATA_DIR);
    // Run in background without awaiting
    void docProcessor.loadDocuments().catch(err => console.error("Background processing error:", err));
}

export async function getVaultStats() {
    try {
        const { getTable } = await import('../lib/lancedb');
        const table = await getTable('vectors');
        const count = await table.countRows();
        return { count };
    } catch (error) {
        return { count: 0 };
    }
}
