'use client';

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Settings as SettingsIcon, Loader2, RotateCcw, FolderSync, CheckCircle2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from './ui/toast';
import { motion, AnimatePresence } from 'framer-motion';
import type { Settings, ApiResponse } from '@/app/types';

interface Model {
    name: string;
}

interface IngestionProgress {
    isActive: boolean;
    total: number;
    current: number;
    percent: number;
    currentFile: string;
    status: 'idle' | 'clearing' | 'indexing' | 'complete' | 'error';
    message: string;
    errors: number;
}

const DEFAULT_SETTINGS: Settings = {
    ollamaHost: 'http://127.0.0.1:11434',
    embeddingModel: '',
    chatModel: '',
    summarizationModel: '',
    summaryTemperature: 0.3,
    maxSummaryLength: 100,
    retrievalCollectionCount: 3,
    retrievalDocumentCount: 5,
    retrievalChunkCount: 5,
    systemPrompt: '',
    vaultPath: '',
};

export function SettingsDialog() {
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [loadingModels, setLoadingModels] = useState(false);
    const [progress, setProgress] = useState<IngestionProgress>({
        isActive: false,
        total: 0,
        current: 0,
        percent: 0,
        currentFile: '',
        status: 'idle',
        message: '',
        errors: 0
    });
    const { showToast } = useToast();

    const fetchSettings = useCallback(async () => {
        setLoadingSettings(true);
        try {
            const res = await fetch('/api/settings');
            const response: ApiResponse<Settings> = await res.json();
            if (response.success && response.data) {
                setSettings(response.data);
            } else {
                showToast(response.error || 'Failed to load settings', 'error');
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            showToast('Failed to load settings', 'error');
        } finally {
            setLoadingSettings(false);
        }
    }, [showToast]);

    const fetchModels = useCallback(async () => {
        setLoadingModels(true);
        try {
            const res = await fetch('/api/models');
            const data = await res.json();
            if (data.models) {
                setModels(data.models);
            }
        } catch (error) {
            console.error('Failed to fetch models', error);
            showToast('Failed to load Ollama models. Is Ollama running?', 'warning');
        } finally {
            setLoadingModels(false);
        }
    }, [showToast]);

    useEffect(() => {
        if (open) {
            fetchSettings();
            fetchModels();
        }
    }, [open, fetchSettings, fetchModels]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            const response: ApiResponse = await res.json();

            if (response.success) {
                showToast('Settings saved successfully', 'success');
                setOpen(false);
            } else {
                showToast(response.error || 'Failed to save settings', 'error');
            }
        } catch (error) {
            console.error('Failed to save settings', error);
            showToast('Failed to save settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleResetToDefaults = async () => {
        try {
            const res = await fetch('/api/settings', { method: 'PUT' });
            const response: ApiResponse<Settings> = await res.json();
            if (response.success && response.data) {
                setSettings(response.data);
                showToast('Settings reset to defaults', 'success');
            }
        } catch (error) {
            console.error('Failed to reset settings:', error);
            showToast('Failed to reset settings', 'error');
        }
    };

    const handleIngest = async () => {
        if (!confirm('This will scan the vault and re-index all files. Continue?')) return;

        setProgress({
            isActive: true,
            total: 0,
            current: 0,
            percent: 0,
            currentFile: '',
            status: 'clearing',
            message: 'Preparing...',
            errors: 0
        });

        try {
            const response = await fetch('/api/vault/ingest', { method: 'POST' });
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('Failed to start ingestion stream');
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            switch (data.type) {
                                case 'start':
                                    setProgress(p => ({
                                        ...p,
                                        total: data.total,
                                        status: 'indexing',
                                        message: `Found ${data.total} files`
                                    }));
                                    break;
                                case 'status':
                                    setProgress(p => ({
                                        ...p,
                                        message: data.message
                                    }));
                                    break;
                                case 'progress':
                                    setProgress(p => ({
                                        ...p,
                                        current: data.current,
                                        percent: data.percent,
                                        currentFile: data.file,
                                        message: `Processing ${data.current} of ${data.total}`
                                    }));
                                    break;
                                case 'file_error':
                                    setProgress(p => ({
                                        ...p,
                                        errors: p.errors + 1
                                    }));
                                    break;
                                case 'complete':
                                    setProgress(p => ({
                                        ...p,
                                        status: 'complete',
                                        percent: 100,
                                        message: data.message,
                                        errors: data.errors
                                    }));
                                    showToast(`Indexed ${data.indexed} files successfully`, 'success');
                                    break;
                                case 'error':
                                    setProgress(p => ({
                                        ...p,
                                        status: 'error',
                                        message: data.message
                                    }));
                                    showToast(data.message, 'error');
                                    break;
                            }
                        } catch (e) {
                            // Ignore parse errors for partial messages
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Ingestion failed:', error);
            setProgress(p => ({
                ...p,
                status: 'error',
                message: error instanceof Error ? error.message : 'Unknown error'
            }));
            showToast('Failed to start ingestion', 'error');
        }
    };

    const resetProgress = () => {
        setProgress({
            isActive: false,
            total: 0,
            current: 0,
            percent: 0,
            currentFile: '',
            status: 'idle',
            message: '',
            errors: 0
        });
    };

    const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const renderModelSelect = (
        id: string,
        label: string,
        value: string,
        onChange: (val: string) => void
    ) => (
        <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={id} className="text-right text-gray-300">
                {label}
            </Label>
            <Select value={value} onValueChange={onChange} disabled={loadingModels}>
                <SelectTrigger className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:ring-rose-500/20">
                    {loadingModels ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Loading models...</span>
                        </div>
                    ) : (
                        <SelectValue placeholder="Select model" />
                    )}
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10 text-gray-100 z-[100] max-h-[300px]">
                    {models.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">No models found</div>
                    ) : models.map((model) => (
                        <SelectItem key={model.name} value={model.name}>
                            {model.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    const renderNumberInput = (
        id: string,
        label: string,
        value: number,
        onChange: (val: number) => void,
        options?: { min?: number; max?: number; step?: number }
    ) => (
        <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={id} className="text-right text-gray-300">
                {label}
            </Label>
            <Input
                id={id}
                type="number"
                step={options?.step ?? 1}
                min={options?.min}
                max={options?.max}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:border-rose-500/50 focus:ring-rose-500/20"
            />
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5">
                    <SettingsIcon className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-black/90 backdrop-blur-xl text-gray-100 border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent">Settings</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Configure your RAG pipeline settings.
                    </DialogDescription>
                </DialogHeader>

                {loadingSettings ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                    </div>
                ) : (
                    <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                        {/* Ollama Settings */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="host" className="text-right text-gray-300">
                                Ollama Host
                            </Label>
                            <Input
                                id="host"
                                value={settings.ollamaHost}
                                onChange={(e) => updateSetting('ollamaHost', e.target.value)}
                                className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:border-rose-500/50 focus:ring-rose-500/20"
                                placeholder="http://127.0.0.1:11434"
                            />
                        </div>

                        {renderModelSelect('embedding', 'Embedding', settings.embeddingModel, (val) => updateSetting('embeddingModel', val))}
                        {renderModelSelect('chat', 'Chat Model', settings.chatModel, (val) => updateSetting('chatModel', val))}

                        <div className="border-t border-white/10 my-2"></div>
                        <div className="text-sm font-semibold text-rose-400 mb-2">Second Brain (Vault)</div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="vault" className="text-right text-gray-300">
                                Vault Path
                            </Label>
                            <Input
                                id="vault"
                                value={settings.vaultPath}
                                onChange={(e) => updateSetting('vaultPath', e.target.value)}
                                className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:border-rose-500/50 focus:ring-rose-500/20"
                                placeholder="F:\Workspace\ObsidianVault"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4 mt-2">
                            <div className="col-start-2 col-span-3">
                                <AnimatePresence mode="wait">
                                    {progress.isActive ? (
                                        <motion.div
                                            key="progress"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-3 p-4 rounded-lg bg-white/5 border border-white/10"
                                        >
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    {progress.status === 'complete' ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                    ) : progress.status === 'error' ? (
                                                        <XCircle className="w-4 h-4 text-red-400" />
                                                    ) : (
                                                        <FolderSync className="w-4 h-4 text-rose-400 animate-spin" />
                                                    )}
                                                    <span className={progress.status === 'complete' ? 'text-emerald-400' : progress.status === 'error' ? 'text-red-400' : 'text-gray-300'}>
                                                        {progress.message}
                                                    </span>
                                                </div>
                                                <span className="text-gray-500 text-xs">{progress.percent}%</span>
                                            </div>

                                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                                <motion.div
                                                    className={`h-full rounded-full ${progress.status === 'complete' ? 'bg-emerald-500' : progress.status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-rose-500 to-amber-500'}`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progress.percent}%` }}
                                                    transition={{ duration: 0.3 }}
                                                />
                                            </div>

                                            {progress.currentFile && progress.status === 'indexing' && (
                                                <div className="text-xs text-gray-500 truncate">
                                                    📄 {progress.currentFile}
                                                </div>
                                            )}

                                            {progress.errors > 0 && (
                                                <div className="text-xs text-amber-400">
                                                    ⚠️ {progress.errors} file(s) had errors
                                                </div>
                                            )}

                                            {(progress.status === 'complete' || progress.status === 'error') && (
                                                <Button
                                                    onClick={resetProgress}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full text-gray-400 hover:text-white"
                                                >
                                                    Dismiss
                                                </Button>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                            <Button
                                                onClick={handleIngest}
                                                variant="secondary"
                                                size="sm"
                                                className="w-full bg-white/10 hover:bg-white/20 text-rose-200"
                                            >
                                                <FolderSync className="w-4 h-4 mr-2" />
                                                Re-index Vault
                                            </Button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="border-t border-white/10 my-2"></div>
                        <div className="text-sm font-semibold text-rose-400 mb-2">Summarization</div>

                        {renderModelSelect('summarization', 'Model', settings.summarizationModel, (val) => updateSetting('summarizationModel', val))}
                        {renderNumberInput('temp', 'Temp', settings.summaryTemperature, (val) => updateSetting('summaryTemperature', val), { min: 0, max: 2, step: 0.1 })}
                        {renderNumberInput('length', 'Max Len', settings.maxSummaryLength, (val) => updateSetting('maxSummaryLength', Math.round(val)))}

                        <div className="border-t border-white/10 my-2"></div>
                        <div className="text-sm font-semibold text-rose-400 mb-2">Retrieval Counts</div>

                        {renderNumberInput('col-count', 'Collections', settings.retrievalCollectionCount, (val) => updateSetting('retrievalCollectionCount', Math.round(val)))}
                        {renderNumberInput('doc-count', 'Documents', settings.retrievalDocumentCount, (val) => updateSetting('retrievalDocumentCount', Math.round(val)))}
                        {renderNumberInput('chunk-count', 'Chunks', settings.retrievalChunkCount, (val) => updateSetting('retrievalChunkCount', Math.round(val)))}

                        <div className="border-t border-white/10 my-2"></div>
                        <div className="text-sm font-semibold text-rose-400 mb-2">System Prompt</div>

                        <div className="grid gap-2">
                            <Label htmlFor="prompt" className="text-gray-300">
                                Custom Prompt (Leave empty for default)
                            </Label>
                            <textarea
                                id="prompt"
                                value={settings.systemPrompt}
                                onChange={(e) => updateSetting('systemPrompt', e.target.value)}
                                className="w-full h-32 bg-white/5 border border-white/10 rounded-md p-2 text-sm text-gray-100 focus:border-rose-500/50 focus:ring-rose-500/20 resize-none"
                                placeholder="Enter custom system prompt..."
                            />
                        </div>
                    </div>
                )}

                <DialogFooter className="flex gap-2">
                    <Button
                        onClick={handleResetToDefaults}
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-white"
                        disabled={loading || loadingSettings}
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading || loadingSettings}
                        className="bg-rose-600 hover:bg-rose-700 text-white border-0"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save changes'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
