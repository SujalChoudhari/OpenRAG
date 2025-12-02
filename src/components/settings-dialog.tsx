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
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                    <SettingsIcon className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-gray-800 text-gray-100 border-gray-700">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Configure your RAG pipeline settings.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="host" className="text-right">
                            Ollama Host
                        </Label>
                        <Input
                            id="host"
                            value={settings.ollamaHost}
                            onChange={(e) => setSettings({ ...settings, ollamaHost: e.target.value })}
                            className="col-span-3 bg-gray-700 border-gray-600 text-gray-100"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="embedding" className="text-right">
                            Embedding
                        </Label>
                        <Select
                            value={settings.embeddingModel}
                            onValueChange={(val) => setSettings({ ...settings, embeddingModel: val })}
                        >
                            <SelectTrigger className="col-span-3 bg-gray-700 border-gray-600 text-gray-100">
                                <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-700 border-gray-600 text-gray-100">
                                {models.map((model) => (
                                    <SelectItem key={model.name} value={model.name}>
                                        {model.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="chat" className="text-right">
                            Chat Model
                        </Label>
                        <Select
                            value={settings.chatModel}
                            onValueChange={(val) => setSettings({ ...settings, chatModel: val })}
                        >
                            <SelectTrigger className="col-span-3 bg-gray-700 border-gray-600 text-gray-100">
                                <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-700 border-gray-600 text-gray-100">
                                {models.map((model) => (
                                    <SelectItem key={model.name} value={model.name}>
                                        {model.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={loading} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                        {loading ? 'Saving...' : 'Save changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
