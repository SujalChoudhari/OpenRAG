'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextureButton } from "@/components/ui/texture-button";
import { TextureSeparator } from "@/components/ui/texture-card";
import { File, Trash2, Upload, PlusCircle, MessageSquare, Loader2 } from 'lucide-react';
import { getVaultStats } from "@/app/actions";
import * as React from 'react';
import { useRef, useCallback, useState, useEffect } from 'react';
import { SettingsDialog } from "./settings-dialog";
import { useToast } from "./ui/toast";
import Image from 'next/image';

interface SidebarProps {
    files: string[];
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onDelete: (fileName: string) => void;
    onReset: () => void;
    onSelectSession: (id: string) => void;
    currentSessionId: string | null;
    uploadLogs: string[];
    isLoadingSession?: boolean;
}

interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
}

export function Sidebar({
    files,
    onUpload,
    onDelete,
    onReset,
    onSelectSession,
    currentSessionId,
    uploadLogs,
    isLoadingSession = false
}: SidebarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [vaultCount, setVaultCount] = useState(0);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const { showToast } = useToast();

    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setLoadingSessions(false);
        }

        try {
            const stats = await getVaultStats();
            setVaultCount(stats.count);
        } catch (err) {
            console.error('Failed to load vault stats:', err);
        }
    }, []);

    useEffect(() => {
        fetchSessions();
        // Poll for updates every 10 seconds (increased from 5 to reduce load)
        const interval = setInterval(fetchSessions, 10000);
        return () => clearInterval(interval);
    }, [fetchSessions]);

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const deleteSession = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this chat?')) {
            try {
                await fetch(`/api/history/${id}`, { method: 'DELETE' });
                fetchSessions();
                if (currentSessionId === id) {
                    onReset();
                }
                showToast('Chat deleted', 'success');
            } catch (error) {
                console.error('Failed to delete session:', error);
                showToast('Failed to delete chat', 'error');
            }
        }
    };

    const clearHistory = async () => {
        if (confirm('Are you sure you want to clear ALL chat history? This cannot be undone.')) {
            try {
                await fetch('/api/history/clear', { method: 'DELETE' });
                fetchSessions();
                onReset();
                showToast('All chats cleared', 'success');
            } catch (error) {
                console.error('Failed to clear history:', error);
                showToast('Failed to clear history', 'error');
            }
        }
    };

    // Memoize upload progress rendering
    const renderUploadProgress = useCallback(() => {
        if (uploadLogs.length === 0) return null;

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
            <div className="px-4 py-3">
                <h3 className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">
                    Upload Progress
                </h3>
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-neutral-400">
                        <span>{statusText}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ease-out rounded-full ${statusText === 'Error' ? 'bg-red-500' : 'bg-gradient-to-r from-rose-500 to-amber-500'}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }, [uploadLogs]);

    return (
        <div className="w-80 glass-panel flex flex-col h-screen z-50 texture-noise">
            {/* Header with Logo */}
            <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-glow-accent flex items-center justify-center bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-white/10">
                        <Image
                            src="/logo.png"
                            alt="OpenRAG"
                            width={28}
                            height={28}
                            className="object-contain"
                        />
                    </div>
                    <h2 className="text-lg font-bold text-gradient">OpenRAG</h2>
                </div>
                <div className="flex gap-1.5">
                    <TextureButton
                        onClick={onReset}
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        title="New Chat"
                        disabled={isLoadingSession}
                    >
                        <PlusCircle className="h-4 w-4" />
                    </TextureButton>
                    <SettingsDialog />
                </div>
            </div>

            <TextureSeparator />

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                    {/* Files Section */}
                    <div className="glass-card rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
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
                            <TextureButton
                                onClick={triggerFileUpload}
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                            >
                                <Upload className="h-3 w-3 mr-1.5" />
                                Add
                            </TextureButton>
                        </div>

                        {vaultCount > 0 && (
                            <div className="mb-3 p-3 rounded-lg bg-gradient-to-r from-rose-500/10 to-amber-500/10 border border-white/[0.06] flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500/30 to-amber-500/30 flex items-center justify-center border border-white/10">
                                    <span className="text-gradient text-xs font-bold">SB</span>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-neutral-200">Second Brain Active</div>
                                    <div className="text-[10px] text-neutral-500">{vaultCount} items indexed</div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            {files.length === 0 ? (
                                <div className="text-center py-6 border border-dashed border-white/[0.08] rounded-lg bg-white/[0.02]">
                                    <File className="h-7 w-7 text-neutral-600 mx-auto mb-2" />
                                    <p className="text-xs text-neutral-500">No files uploaded</p>
                                </div>
                            ) : (
                                files.map((file) => (
                                    <div
                                        key={file}
                                        className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.04] transition-all duration-200 border border-transparent hover:border-white/[0.06]"
                                    >
                                        <div className="flex items-center overflow-hidden">
                                            <File className="h-4 w-4 text-rose-400 mr-2.5 flex-shrink-0" />
                                            <span className="text-sm text-neutral-300 truncate" title={file}>
                                                {file}
                                            </span>
                                        </div>
                                        <TextureButton
                                            onClick={() => onDelete(file)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 transition-all"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </TextureButton>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Upload Logs Section */}
                    {renderUploadProgress()}

                    {/* History Section */}
                    <div className="glass-card rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                History
                            </h3>
                            {sessions.length > 0 && (
                                <TextureButton
                                    onClick={clearHistory}
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] text-neutral-500 hover:text-red-400"
                                >
                                    Clear
                                </TextureButton>
                            )}
                        </div>

                        {loadingSessions ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="text-center py-6 text-xs text-neutral-500">
                                No chat history yet
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {sessions.map((session) => (
                                    <div
                                        key={session.id}
                                        onClick={() => !isLoadingSession && onSelectSession(session.id)}
                                        className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all duration-200 ${currentSessionId === session.id
                                            ? 'bg-gradient-to-r from-rose-500/15 to-amber-500/10 border border-rose-500/20'
                                            : 'hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06]'
                                            } ${isLoadingSession ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                        <div className="flex items-center overflow-hidden">
                                            {isLoadingSession && currentSessionId === session.id ? (
                                                <Loader2 className="mr-2.5 h-4 w-4 flex-shrink-0 animate-spin text-rose-400" />
                                            ) : (
                                                <MessageSquare className={`mr-2.5 h-4 w-4 flex-shrink-0 ${currentSessionId === session.id ? 'text-rose-400' : 'text-neutral-500'
                                                    }`} />
                                            )}
                                            <span className={`text-sm truncate ${currentSessionId === session.id ? 'text-neutral-100' : 'text-neutral-300'
                                                }`} title={session.title}>
                                                {session.title}
                                            </span>
                                        </div>
                                        <TextureButton
                                            onClick={(e) => deleteSession(e, session.id)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 transition-all"
                                            disabled={isLoadingSession}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </TextureButton>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            <TextureSeparator />
            <div className="p-4 text-xs text-center text-neutral-600">
                Powered by Ollama & OpenRAG
            </div>
        </div>
    );
}
