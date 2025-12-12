'use client'

import { getFiles, removeFile } from './actions'
import { useChat, Message } from 'ai/react'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Sidebar } from '@/components/sidebar'
import { ChatArea } from '@/components/chat-area'
import { PersonaManager } from '@/components/persona-manager'
import { useToast } from '@/components/ui/toast'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderSync, X, FileText, FilePlus, FileX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ApiResponse } from './types'

interface LoadedSession {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

interface Persona {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  systemPrompt: string;
}

interface VaultChanges {
  newFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
}

export default function ChatInterface() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [typingMessage, setTypingMessage] = useState<string>('');
  const [uploadLogs, setUploadLogs] = useState<string[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [vaultChanges, setVaultChanges] = useState<VaultChanges | null>(null);
  const [showChangesPopup, setShowChangesPopup] = useState(false);

  // Track if files have been loaded to prevent infinite loops
  const filesLoadedRef = useRef(false);

  const { messages, input, handleInputChange, handleSubmit, setMessages, data, isLoading } = useChat({
    keepLastMessageOnError: true,
    body: {
      sessionId,
      personaId: selectedPersona?.id,
      personaPrompt: selectedPersona?.systemPrompt
    },
    onResponse: (response) => {
      setIsTyping(false);
      const newSessionId = response.headers.get('X-Session-Id');
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId);
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
      setIsTyping(false);
    }
  });

  const typingMessages = [
    "Looking into the databases...",
    "Getting things ready...",
    "Just a minute...",
    "Wait for a minute...",
    "Crafting a nice response...",
    "Fetching data from the system...",
    "Analyzing your query...",
    "Almost there..."
  ];

  const handleSubmitWrapper = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() && !isTyping && !isLoading) {
      const randomMessage = typingMessages[Math.floor(Math.random() * typingMessages.length)];
      setTypingMessage(randomMessage);
      setIsTyping(true);
      handleSubmit(e);
    }
  }, [input, isTyping, isLoading, handleSubmit, typingMessages]);

  // Load files on mount only
  useEffect(() => {
    const loadFiles = async () => {
      if (filesLoadedRef.current) return;
      try {
        const newFiles = await getFiles();
        setFiles(newFiles);
        filesLoadedRef.current = true;
      } catch (error) {
        console.error('Failed to load files:', error);
      }
    };
    loadFiles();
  }, []);

  // Load default persona on mount
  useEffect(() => {
    const loadDefaultPersona = async () => {
      try {
        const res = await fetch('/api/personas');
        const response: ApiResponse<Persona[]> = await res.json();
        if (response.success && response.data && response.data.length > 0) {
          const defaultPersona = response.data.find(p => (p as Persona & { isDefault?: boolean }).isDefault) || response.data[0];
          setSelectedPersona(defaultPersona);
        }
      } catch (error) {
        console.error('Failed to load default persona:', error);
      }
    };
    loadDefaultPersona();
  }, []);

  // Check for vault changes on mount (don't auto-sync, show popup instead)
  const { showToast } = useToast();
  const syncInitiatedRef = useRef(false);

  useEffect(() => {
    if (syncInitiatedRef.current) return;
    syncInitiatedRef.current = true;

    const checkVaultChanges = async () => {
      try {
        console.log('Checking for vault changes...');
        const res = await fetch('/api/vault/sync?checkOnly=true');
        const data = await res.json();

        if (data.success && data.hasChanges) {
          setVaultChanges(data.changes);
          setShowChangesPopup(true);
          console.log('Vault changes detected:', data.changes);
        } else {
          console.log('No vault changes detected.');
        }
      } catch (error) {
        console.error('Vault check failed:', error);
      }
    };

    // Small delay to let initial render settle
    setTimeout(checkVaultChanges, 1000);
  }, []);

  const handleIngestChanges = async () => {
    setShowChangesPopup(false);
    showToast('Syncing vault changes...', 'info');

    try {
      const res = await fetch('/api/vault/sync', { method: 'POST' });
      const data = await res.json();

      if (data.success && data.stats) {
        const { added, updated, deleted } = data.stats;
        showToast(`Synced: +${added} new, ~${updated} updated, -${deleted} removed`, 'success');
      }
    } catch (error) {
      console.error('Vault sync failed:', error);
      showToast('Sync failed. Try re-indexing from Settings.', 'error');
    }

    setVaultChanges(null);
  };

  const dismissChangesPopup = () => {
    setShowChangesPopup(false);
    setVaultChanges(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = event.target.files;
    if (!newFiles || newFiles.length === 0) return;

    setUploadLogs([]);
    const formData = new FormData();
    Array.from(newFiles).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        setUploadLogs(prev => [...prev, ...lines]);
      }

      // Refresh file list
      const updatedFiles = await getFiles();
      setFiles(updatedFiles);

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadLogs(prev => [...prev, `Error: ${error}`]);
    }
  };

  const deleteFile = useCallback(async (fileName: string) => {
    try {
      await removeFile(fileName);
      setFiles(prevFiles => prevFiles.filter(file => file !== fileName));
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }, []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setIsTyping(false);
    setSessionId(null);
  }, [setMessages]);

  const loadSession = useCallback(async (id: string) => {
    if (isLoadingSession) return;

    setIsLoadingSession(true);
    setIsTyping(false);

    try {
      const res = await fetch(`/api/history/${id}`);
      const response: ApiResponse<LoadedSession> = await res.json();

      if (response.success && response.data) {
        setSessionId(response.data.id);
        // Cast to Message[] as the stored format is compatible
        setMessages(response.data.messages as Message[]);
      } else {
        console.error('Failed to load session:', response.error);
        // Reset to empty state if session not found
        resetChat();
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setIsLoadingSession(false);
    }
  }, [isLoadingSession, setMessages, resetChat]);

  return (
    <div className="flex min-h-screen bg-black text-gray-100 font-sans selection:bg-rose-500/30">
      <Sidebar
        files={files}
        onUpload={handleFileUpload}
        onDelete={deleteFile}
        onReset={resetChat}
        onSelectSession={loadSession}
        currentSessionId={sessionId}
        uploadLogs={uploadLogs}
        isLoadingSession={isLoadingSession}
      />
      <ChatArea
        messages={messages}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmitWrapper}
        isTyping={isTyping || isLoading}
        typingMessage={typingMessage}
        files={files}
        data={data}
        personaSelector={
          <PersonaManager
            selectedPersonaId={selectedPersona?.id || null}
            onSelectPersona={setSelectedPersona}
            files={files}
          />
        }
        selectedPersona={selectedPersona}
      />

      {/* Vault Changes Popup */}
      <AnimatePresence>
        {showChangesPopup && vaultChanges && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={dismissChangesPopup}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-white/[0.08] rounded-2xl shadow-glow max-w-md w-full overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 flex items-center justify-center border border-white/10">
                      <FolderSync className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Vault Changes Detected</h3>
                      <p className="text-xs text-neutral-500">Updates since last sync</p>
                    </div>
                  </div>
                  <button
                    onClick={dismissChangesPopup}
                    className="p-2 rounded-lg hover:bg-white/[0.06] text-neutral-500 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  {vaultChanges.newFiles.length > 0 && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <FilePlus className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div>
                        <div className="text-sm text-emerald-300 font-medium">{vaultChanges.newFiles.length} new file(s)</div>
                        <div className="text-xs text-neutral-500 truncate max-w-[250px]">
                          {vaultChanges.newFiles.slice(0, 2).join(', ')}
                          {vaultChanges.newFiles.length > 2 && ` +${vaultChanges.newFiles.length - 2} more`}
                        </div>
                      </div>
                    </div>
                  )}

                  {vaultChanges.modifiedFiles.length > 0 && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <div>
                        <div className="text-sm text-amber-300 font-medium">{vaultChanges.modifiedFiles.length} modified file(s)</div>
                        <div className="text-xs text-neutral-500 truncate max-w-[250px]">
                          {vaultChanges.modifiedFiles.slice(0, 2).join(', ')}
                          {vaultChanges.modifiedFiles.length > 2 && ` +${vaultChanges.modifiedFiles.length - 2} more`}
                        </div>
                      </div>
                    </div>
                  )}

                  {vaultChanges.deletedFiles.length > 0 && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20">
                      <FileX className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <div>
                        <div className="text-sm text-red-300 font-medium">{vaultChanges.deletedFiles.length} deleted file(s)</div>
                        <div className="text-xs text-neutral-500 truncate max-w-[250px]">
                          {vaultChanges.deletedFiles.slice(0, 2).join(', ')}
                          {vaultChanges.deletedFiles.length > 2 && ` +${vaultChanges.deletedFiles.length - 2} more`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={dismissChangesPopup}
                    variant="ghost"
                    className="flex-1 text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-xl"
                  >
                    Dismiss
                  </Button>
                  <Button
                    onClick={handleIngestChanges}
                    className="flex-1 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl shadow-glow-accent"
                  >
                    <FolderSync className="w-4 h-4 mr-2" />
                    Sync Now
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}