'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextureButton } from "@/components/ui/texture-button";
import { TextureSeparator } from "@/components/ui/texture-card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { File, Trash2, Upload, PlusCircle, MessageSquare, Loader2, PanelLeftClose, PanelLeft } from 'lucide-react';
import { getVaultStats } from "@/app/actions";
import * as React from 'react';
import { useRef, useCallback, useState, useEffect } from 'react';
import { SettingsDialog } from "./settings-dialog";
import { useToast } from "./ui/toast";
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
    files: string[];
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onDelete: (fileName: string) => void;
    onReset: () => void;
    onSelectSession: (id: string) => void;
    currentSessionId: string | null;
    uploadLogs: string[];
    isLoadingSession?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
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
    isLoadingSession = false,
    isCollapsed = false,
    onToggleCollapse
}: SidebarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [vaultCount, setVaultCount] = useState(0);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const { showToast } = useToast();

    // Confirm modal states
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [clearModalOpen, setClearModalOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setPendingDeleteId(id);
        setDeleteModalOpen(true);
    };

    const confirmDeleteSession = async () => {
        if (!pendingDeleteId) return;
        try {
            await fetch(`/api/history/${pendingDeleteId}`, { method: 'DELETE' });
            fetchSessions();
            if (currentSessionId === pendingDeleteId) {
                onReset();
            }
            showToast('Chat deleted', 'success');
        } catch {
            showToast('Failed to delete chat', 'error');
        } finally {
            setDeleteModalOpen(false);
            setPendingDeleteId(null);
        }
    };

    const handleClearClick = () => {
        setClearModalOpen(true);
    };

    const confirmClearHistory = async () => {
        try {
            await fetch('/api/history/clear', { method: 'DELETE' });
            fetchSessions();
            onReset();
            showToast('All chats cleared', 'success');
        } catch {
            showToast('Failed to clear history', 'error');
        } finally {
            setClearModalOpen(false);
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
        <motion.div
            className="glass-panel flex flex-col h-screen z-50 texture-noise border-r border-white/[0.08]"
            animate={{ width: isCollapsed ? 72 : 320 }}
            initial={false}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
            {/* Header with Logo */}
            <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center">
                        <Image src="/logo.png" alt="OpenRAG" width={80} height={80} className="object-cover" />
                    </div>
                    <AnimatePresence mode="wait">
                        {!isCollapsed && (
                            <motion.h2
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="text-lg font-bold text-gradient whitespace-nowrap"
                            >
                                OpenRAG
                            </motion.h2>
                        )}
                    </AnimatePresence>
                </div>
                <AnimatePresence mode="wait">
                    {!isCollapsed && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex gap-1.5"
                        >
                            <SettingsDialog />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* New Chat Button */}
            <div className={`px-4 pb-3 ${isCollapsed ? 'px-3' : ''}`}>
                <TextureButton
                    onClick={onReset}
                    variant="accent"
                    className={`w-full ${isCollapsed ? 'h-10 w-10 px-0' : ''} rounded-xl`}
                    disabled={isLoadingSession}
                    title="New Chat"
                >
                    <PlusCircle className={`h-4 w-4 ${isCollapsed ? '' : 'mr-2'}`} />
                    {!isCollapsed && <span>New Chat</span>}
                </TextureButton>
            </div>

            <TextureSeparator />

            <AnimatePresence mode="wait">
                {!isCollapsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 overflow-hidden flex flex-col"
                    >
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
                                            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400">
                                                <span className="text-xs font-bold">SB</span>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-white">Knowledge Base Active</div>
                                                <div className="text-[10px] text-rose-200/60">{vaultCount} items indexed</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {files.length === 0 ? (
                                            <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-xl bg-white/[0.02]">
                                                <File className="mx-auto h-8 w-8 text-neutral-600 mb-2 opacity-50" />
                                                <p className="text-xs text-neutral-500">No files uploaded</p>
                                            </div>
                                        ) : (
                                            files.map((file, i) => (
                                                <div
                                                    key={i}
                                                    className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.04] border border-transparent hover:border-white/[0.04] transition-all"
                                                >
                                                    <div className="flex items-center space-x-2.5 overflow-hidden">
                                                        <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400">
                                                            <File className="h-3.5 w-3.5" />
                                                        </div>
                                                        <span className="text-sm text-neutral-300 truncate max-w-[140px] group-hover:text-neutral-100 transition-colors">
                                                            {file}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => onDelete(file)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md transition-all"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Upload Progress */}
                                    {renderUploadProgress()}
                                </div>

                                {/* History Section */}
                                <div className="glass-card rounded-xl p-4">
                                    <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                                        History
                                    </h3>
                                    <div className="space-y-1">
                                        {loadingSessions ? (
                                            <div className="flex justify-center py-4">
                                                <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
                                            </div>
                                        ) : sessions.length === 0 ? (
                                            <div className="text-center py-6">
                                                <p className="text-xs text-neutral-600">No chat history yet</p>
                                            </div>
                                        ) : (
                                            sessions.map((session) => (
                                                <div
                                                    key={session.id}
                                                    className={`group flex items-center justify-between p-2 rounded-lg transition-all border ${currentSessionId === session.id
                                                        ? 'bg-white/[0.06] border-white/10 text-white shadow-sm'
                                                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04] border-transparent'
                                                        }`}
                                                >
                                                    <button
                                                        className="flex items-center space-x-3 flex-1 overflow-hidden text-left"
                                                        onClick={() => onSelectSession(session.id)}
                                                    >
                                                        <MessageSquare className={`h-3.5 w-3.5 flex-shrink-0 ${currentSessionId === session.id ? 'text-amber-400' : 'text-neutral-600 group-hover:text-neutral-400'
                                                            }`} />
                                                        <span className="text-sm truncate">
                                                            {session.title || 'New Chat'}
                                                        </span>
                                                    </button>
                                                    <button
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                                                        onClick={(e) => handleDeleteClick(e, session.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {sessions.length > 0 && (
                                        <TextureButton
                                            className="w-full mt-3 text-xs h-7"
                                            variant="ghost"
                                            onClick={handleClearClick}
                                        >
                                            Clear All
                                        </TextureButton>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer with toggle */}
            {isCollapsed ? (
                <div className="p-3 mt-auto flex justify-center border-t border-white/[0.08]">
                    <TextureButton
                        onClick={onToggleCollapse}
                        variant="ghost"
                        size="icon-sm"
                        title="Expand Sidebar"
                        className="rounded-lg text-neutral-500 hover:text-neutral-200"
                    >
                        <PanelLeft className="h-4 w-4" />
                    </TextureButton>
                </div>
            ) : (
                <div className="mt-auto">
                    <TextureSeparator />
                    <div className="p-4 flex items-center justify-between">
                        <span className="text-xs text-neutral-600">
                            Powered by Ollama & OpenRAG
                        </span>
                        <TextureButton
                            onClick={onToggleCollapse}
                            variant="ghost"
                            size="icon-sm"
                            title="Collapse Sidebar"
                            className="rounded-lg text-neutral-500 hover:text-neutral-200"
                        >
                            <PanelLeftClose className="h-4 w-4" />
                        </TextureButton>
                    </div>
                </div>
            )}

            {/* Confirm Modals */}
            <ConfirmModal
                open={deleteModalOpen}
                onConfirm={confirmDeleteSession}
                onCancel={() => { setDeleteModalOpen(false); setPendingDeleteId(null); }}
                title="Delete Chat"
                description="Are you sure you want to delete this chat? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
            />
            <ConfirmModal
                open={clearModalOpen}
                onConfirm={confirmClearHistory}
                onCancel={() => setClearModalOpen(false)}
                title="Clear All History"
                description="Are you sure you want to clear ALL chat history? This action cannot be undone."
                confirmText="Clear All"
                variant="danger"
            />
        </motion.div>
    );
}
