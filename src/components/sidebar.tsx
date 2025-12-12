'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { File, Trash2, Upload, PlusCircle, MessageSquare } from 'lucide-react';
import { getVaultStats } from "@/app/actions";
import * as React from 'react';
import { useRef } from 'react';
import { SettingsDialog } from "./settings-dialog";

interface SidebarProps {
    files: string[];
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onDelete: (fileName: string) => void;
    onReset: () => void;
    onSelectSession: (id: string) => void;
    currentSessionId: string | null;
    uploadLogs: string[];
}

interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
}

export function Sidebar({ files, onUpload, onDelete, onReset, onSelectSession, currentSessionId, uploadLogs }: SidebarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [sessions, setSessions] = React.useState<ChatSession[]>([]);
    const [vaultCount, setVaultCount] = React.useState(0);

    const fetchSessions = () => {
        fetch('/api/history')
            .then(res => res.json())
            .then(data => setSessions(data.sessions || []))
            .catch(err => console.error('Failed to load history:', err));

        getVaultStats().then(stats => setVaultCount(stats.count));
    };

    React.useEffect(() => {
        fetchSessions();
        // Poll for updates every 5 seconds to catch new titles
        const interval = setInterval(fetchSessions, 5000);
        return () => clearInterval(interval);
    }, []);

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const deleteSession = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this chat?')) {
            await fetch(`/api/history/${id}`, { method: 'DELETE' });
            fetchSessions();
            if (currentSessionId === id) {
                onReset();
            }
        }
    };

    const clearHistory = async () => {
        if (confirm('Are you sure you want to clear ALL chat history? This cannot be undone.')) {
            await fetch('/api/history/clear', { method: 'DELETE' });
            fetchSessions();
            onReset();
        }
    };

    return (
        <div className="w-80 glass-panel bg-black/60 flex flex-col h-screen border-r border-white/5 z-50">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                <h2 className="text-xl font-bold bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent flex items-center gap-2">
                    <span className="text-2xl">✦</span> OpenRAG
                </h2>
                <div className="flex gap-2">
                    <Button onClick={onReset} variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full" title="New Chat">
                        <PlusCircle className="h-5 w-5" />
                    </Button>
                    <SettingsDialog />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Files Section */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Knowledge Base
                            </h3>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={onUpload}
                                className="hidden"
                                multiple
                                accept=".txt,.md,.pdf,.json"
                            />
                            <Button
                                onClick={triggerFileUpload}
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs border-white/10 hover:bg-white/5 hover:text-rose-400"
                            >
                                <Upload className="h-3 w-3 mr-2" />
                                Add Files
                            </Button>
                        </div>

                        {vaultCount > 0 && (
                            <div className="mb-4 p-3 bg-white/5 border border-white/5 rounded-lg flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                                    <span className="text-rose-400 text-xs font-bold">SB</span>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-gray-200">Second Brain Active</div>
                                    <div className="text-[10px] text-gray-400">{vaultCount} items indexed</div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {files.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-lg">
                                    <File className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                                    <p className="text-xs text-gray-500">No files uploaded</p>
                                </div>
                            ) : (
                                files.map((file) => (
                                    <div
                                        key={file}
                                        className="group flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
                                    >
                                        <div className="flex items-center overflow-hidden">
                                            <File className="h-4 w-4 text-rose-500 mr-2 flex-shrink-0" />
                                            <span className="text-sm text-gray-300 truncate" title={file}>
                                                {file}
                                            </span>
                                        </div>
                                        <Button
                                            onClick={() => onDelete(file)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Upload Logs Section */}
                    {uploadLogs.length > 0 && (
                        <div className="px-4 py-2 border-t border-white/10">
                            <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                                Upload Progress
                            </h3>
                            <div className="space-y-1">
                                {(() => {
                                    const lastLog = uploadLogs[uploadLogs.length - 1];
                                    if (!lastLog) return null;

                                    const match = lastLog.match(/chunk (\d+)\/(\d+)/);
                                    let progress = 0;
                                    let statusText = lastLog;

                                    if (match) {
                                        const current = parseInt(match[1]);
                                        const total = parseInt(match[2]);
                                        progress = (current / total) * 100;
                                        statusText = `Processing chunk ${current}/${total}`;
                                    } else if (lastLog.includes("All files processed successfully")) {
                                        progress = 100;
                                        statusText = "Complete";
                                    } else if (lastLog.startsWith("Error")) {
                                        statusText = "Error";
                                        progress = 100;
                                    }

                                    if (statusText === "Complete") return null;

                                    return (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs text-gray-400">
                                                <span>{statusText}</span>
                                                <span>{Math.round(progress)}%</span>
                                            </div>
                                            <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-300 ease-out ${statusText === 'Error' ? 'bg-red-500' : 'bg-rose-500'}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* History Section */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                History
                            </h3>
                            {sessions.length > 0 && (
                                <Button
                                    onClick={clearHistory}
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] text-gray-500 hover:text-red-400 hover:bg-white/5"
                                >
                                    Clear All
                                </Button>
                            )}
                        </div>
                        <div className="space-y-1">
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => onSelectSession(session.id)}
                                    className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${currentSessionId === session.id
                                        ? 'bg-rose-500/10 border border-rose-500/20'
                                        : 'hover:bg-white/5 border border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center overflow-hidden">
                                        <MessageSquare className={`mr-3 h-4 w-4 flex-shrink-0 ${currentSessionId === session.id ? 'text-rose-400' : 'text-gray-400'
                                            }`} />
                                        <span className={`text-sm truncate ${currentSessionId === session.id ? 'text-rose-100' : 'text-gray-300'
                                            }`} title={session.title}>
                                            {session.title}
                                        </span>
                                    </div>
                                    <Button
                                        onClick={(e) => deleteSession(e, session.id)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
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
