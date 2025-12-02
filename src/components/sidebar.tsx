'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { File, Trash2, Upload, PlusCircle } from 'lucide-react';
import * as React from 'react';
import { useRef } from 'react';
import { SettingsDialog } from "./settings-dialog";

interface SidebarProps {
    files: string[];
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onDelete: (fileName: string) => void;
    onReset: () => void;
}

export function Sidebar({ files, onUpload, onDelete, onReset }: SidebarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [historyFiles, setHistoryFiles] = React.useState<string[]>([]);

    React.useEffect(() => {
        fetch('/api/history')
            .then(res => res.json())
            .then(data => setHistoryFiles(data.files || []))
            .catch(err => console.error('Failed to load history:', err));
    }, []);

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="w-80 bg-gray-900/50 backdrop-blur-xl border-r border-white/10 flex flex-col h-screen">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    OpenRAG
                </h2>
                <div className="flex gap-2">
                    <Button onClick={onReset} variant="ghost" size="icon" className="text-gray-400 hover:text-white" title="New Chat">
                        <PlusCircle className="h-5 w-5" />
                    </Button>
                    <SettingsDialog />
                </div>
            </div>

            <div className="p-4">
                <Button
                    onClick={triggerFileUpload}
                    className="w-full bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 backdrop-blur-sm transition-all duration-300"
                >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onUpload}
                    className="hidden"
                    multiple
                />
            </div>

            <ScrollArea className="flex-1 px-4">
                <div className="space-y-6">
                    <div>
                        <div className="px-2 py-2">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                Knowledge Base
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {files.length === 0 && (
                                <div className="text-center text-gray-500 text-sm py-4 italic">
                                    No documents
                                </div>
                            )}
                            {files.map((file, index) => (
                                <div
                                    key={index}
                                    className="group flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all duration-200"
                                >
                                    <div className="flex items-center overflow-hidden">
                                        <File className="mr-3 h-4 w-4 text-cyan-400 flex-shrink-0" />
                                        <span className="text-sm text-gray-300 truncate" title={file}>
                                            {file}
                                        </span>
                                    </div>
                                    <Button
                                        onClick={() => onDelete(file)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-500 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="px-2 py-2">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                Chat History
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {historyFiles.length === 0 && (
                                <div className="text-center text-gray-500 text-sm py-4 italic">
                                    No history
                                </div>
                            )}
                            {historyFiles.map((file, index) => (
                                <div
                                    key={index}
                                    className="group flex items-center p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all duration-200 cursor-pointer"
                                >
                                    <File className="mr-3 h-4 w-4 text-purple-400 flex-shrink-0" />
                                    <span className="text-sm text-gray-300 truncate" title={file}>
                                        {file.replace('History_', '').replace('.md', '').replace(/_/g, ' ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            <div className="p-4 border-t border-white/10 text-xs text-center text-gray-600">
                Powered by Ollama & OpenRAG
            </div>
        </div>
    );
}
