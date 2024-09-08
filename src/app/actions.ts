"use server";

import fs from "fs";
import { removeEmbedding, storeEmbedding } from "./utils/sqliteEmbeddings";
import { LoadDocuments } from "./utils/loadDocs";

// get file list function not dirs
export async function getFiles() {
    const files = fs.readdirSync("_data/upload");
    return files;
}

// delete file function
export async function removeFile(fileName: string) {
    fs.unlinkSync(`_data/upload/${fileName}`);
    removeEmbedding(fileName);
}


export type UploadedFile = {
    name: string;
    content: string;
}
// add file function
export async function addContent(files: UploadedFile[]) {
    const fileArr = Array.from(files);
    for (const file of fileArr) {
        fs.writeFileSync(`_data/upload/${file.name}`, file.content);
    }

    const loadDocs = new LoadDocuments('_data');
    loadDocs.loadDocuments();
}
