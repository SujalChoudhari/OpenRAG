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
import { Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SettingsData {
    ollamaHost: string;
    embeddingModel: string;
    chatModel: string;
    summarizationModel: string;
    summaryTemperature: number;
    maxSummaryLength: number;
    retrievalCollectionCount: number;
    retrievalDocumentCount: number;
    retrievalChunkCount: number;
    systemPrompt: string;
}

interface Model {
    name: string;
}

export function SettingsDialog() {
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState<SettingsData>({
        ollamaHost: '',
        embeddingModel: '',
        chatModel: '',
        summarizationModel: '',
        summaryTemperature: 0.3,
        maxSummaryLength: 100,
        retrievalCollectionCount: 3,
        retrievalDocumentCount: 5,
        retrievalChunkCount: 5,
        systemPrompt: '',
    });
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchSettings();
            fetchModels();
        }
    }, [open]);

    const fetchSettings = async () => {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setSettings(data);
    };

    const fetchModels = async () => {
        try {
            const res = await fetch('/api/models');
            const data = await res.json();
            if (data.models) {
                setModels(data.models);
            }
        } catch (error) {
            console.error('Failed to fetch models', error);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            setOpen(false);
        } catch (error) {
            console.error('Failed to save settings', error);
        } finally {
            setLoading(false);
        }
    };

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
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="host" className="text-right text-gray-300">
                            Ollama Host
                        </Label>
                        <Input
                            id="host"
                            value={settings.ollamaHost}
                            onChange={(e) => setSettings({ ...settings, ollamaHost: e.target.value })}
                            className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:border-rose-500/50 focus:ring-rose-500/20"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="embedding" className="text-right text-gray-300">
                            Embedding
                        </Label>
                        <Select
                            value={settings.embeddingModel}
                            onValueChange={(val) => setSettings({ ...settings, embeddingModel: val })}
                        >
                            <SelectTrigger className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:ring-rose-500/20">
                                <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-white/10 text-gray-100">
                                {models.map((model) => (
                                    <SelectItem key={model.name} value={model.name}>
                                        {model.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="chat" className="text-right text-gray-300">
                            Chat Model
                        </Label>
                        <Select
                            value={settings.chatModel}
                            onValueChange={(val) => setSettings({ ...settings, chatModel: val })}
                        >
                            <SelectTrigger className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:ring-rose-500/20">
                                <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-white/10 text-gray-100">
                                {models.map((model) => (
                                    <SelectItem key={model.name} value={model.name}>
                                        {model.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="border-t border-white/10 my-2"></div>
                    <div className="text-sm font-semibold text-rose-400 mb-2">Summarization</div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="summarization" className="text-right text-gray-300">
                            Model
                        </Label>
                        <Select
                            value={settings.summarizationModel}
                            onValueChange={(val) => setSettings({ ...settings, summarizationModel: val })}
                        >
                            <SelectTrigger className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:ring-rose-500/20">
                                <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-white/10 text-gray-100">
                                {models.map((model) => (
                                    <SelectItem key={model.name} value={model.name}>
                                        {model.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="temp" className="text-right text-gray-300">
                            Temp
                        </Label>
                        <Input
                            id="temp"
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={settings.summaryTemperature}
                            onChange={(e) => setSettings({ ...settings, summaryTemperature: parseFloat(e.target.value) })}
                            className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:border-rose-500/50 focus:ring-rose-500/20"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="length" className="text-right text-gray-300">
                            Max Len
                        </Label>
                        <Input
                            id="length"
                            type="number"
                            value={settings.maxSummaryLength}
                            onChange={(e) => setSettings({ ...settings, maxSummaryLength: parseInt(e.target.value) })}
                            className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:border-rose-500/50 focus:ring-rose-500/20"
                        />
                    </div>

                    <div className="border-t border-white/10 my-2"></div>
                    <div className="text-sm font-semibold text-rose-400 mb-2">Retrieval Counts</div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="col-count" className="text-right text-gray-300">
                            Collections
                        </Label>
                        <Input
                            id="col-count"
                            type="number"
                            value={settings.retrievalCollectionCount}
                            onChange={(e) => setSettings({ ...settings, retrievalCollectionCount: parseInt(e.target.value) })}
                            className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:border-rose-500/50 focus:ring-rose-500/20"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="doc-count" className="text-right text-gray-300">
                            Documents
                        </Label>
                        <Input
                            id="doc-count"
                            type="number"
                            value={settings.retrievalDocumentCount}
                            onChange={(e) => setSettings({ ...settings, retrievalDocumentCount: parseInt(e.target.value) })}
                            className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:border-rose-500/50 focus:ring-rose-500/20"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="chunk-count" className="text-right text-gray-300">
                            Chunks
                        </Label>
                        <Input
                            id="chunk-count"
                            type="number"
                            value={settings.retrievalChunkCount}
                            onChange={(e) => setSettings({ ...settings, retrievalChunkCount: parseInt(e.target.value) })}
                            className="col-span-3 bg-white/5 border-white/10 text-gray-100 focus:border-rose-500/50 focus:ring-rose-500/20"
                        />
                    </div>

                    <div className="border-t border-white/10 my-2"></div>
                    <div className="text-sm font-semibold text-rose-400 mb-2">System Prompt</div>

                    <div className="grid gap-2">
                        <Label htmlFor="prompt" className="text-gray-300">
                            Custom Prompt (Leave empty for default)
                        </Label>
                        <textarea
                            id="prompt"
                            value={settings.systemPrompt || ''}
                            onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                            className="w-full h-32 bg-white/5 border border-white/10 rounded-md p-2 text-sm text-gray-100 focus:border-rose-500/50 focus:ring-rose-500/20 resize-none"
                            placeholder="Enter custom system prompt..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={loading} className="bg-rose-600 hover:bg-rose-700 text-white border-0">
                        {loading ? 'Saving...' : 'Save changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
