'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Users,
    Plus,
    Trash2,
    Edit2,
    Sparkles,
    Loader2,
    Star,
    Search,
    FileText,
    Check
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from './ui/toast';
import { AnimatePresence, motion } from 'framer-motion';
import type { ApiResponse } from '@/app/types';

// Types matching the backend
interface PersonaTone {
    formality: 'casual' | 'neutral' | 'formal' | 'professional';
    warmth: 'cold' | 'neutral' | 'warm' | 'enthusiastic';
    directness: 'indirect' | 'balanced' | 'direct' | 'blunt';
    verbosity: 'concise' | 'balanced' | 'detailed' | 'verbose';
}

interface Persona {
    id: string;
    name: string;
    avatar?: string;
    role: string;
    description: string;
    tone: PersonaTone;
    objectives: string[];
    constraints: string[];
    knowledgeBoundaries: string[];
    systemPrompt: string;
    isDefault?: boolean;
    sourceFiles?: string[];
    createdAt: number;
    updatedAt: number;
}

interface PersonaManagerProps {
    selectedPersonaId: string | null;
    onSelectPersona: (persona: Persona | null) => void;
    files?: string[];
}

export function PersonaManager({ selectedPersonaId, onSelectPersona, files = [] }: PersonaManagerProps) {
    const [open, setOpen] = useState(false);
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);
    const { showToast } = useToast();

    // Generator state
    const [genName, setGenName] = useState('');
    const [genDescription, setGenDescription] = useState('');
    const [genRole, setGenRole] = useState('');
    const [genVaultQuery, setGenVaultQuery] = useState('');
    const [genCustomContext, setGenCustomContext] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

    const fetchPersonas = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/personas');
            const response: ApiResponse<Persona[]> = await res.json();
            if (response.success && response.data) {
                setPersonas(response.data);
                // Auto-select default if none selected
                if (!selectedPersonaId && response.data.length > 0) {
                    const defaultPersona = response.data.find(p => p.isDefault) || response.data[0];
                    onSelectPersona(defaultPersona);
                }
            }
        } catch (error) {
            console.error('Failed to fetch personas:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedPersonaId, onSelectPersona]);

    const [vaultFiles, setVaultFiles] = useState<{ name: string, path: string }[]>([]);

    useEffect(() => {
        if (open) {
            fetchPersonas();
            // Fetch vault files
            fetch('/api/vault/files')
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setVaultFiles(data.files);
                    }
                })
                .catch(console.error);
        }
    }, [open, fetchPersonas]);

    // ... (keep handling functions)

    const toggleFileSelection = (filePath: string) => {
        setSelectedFiles(prev =>
            prev.includes(filePath)
                ? prev.filter(f => f !== filePath)
                : [...prev, filePath]
        );
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this persona?')) return;

        try {
            await fetch(`/api/personas/${id}`, { method: 'DELETE' });
            showToast('Persona deleted', 'success');
            fetchPersonas();
            if (selectedPersonaId === id) {
                onSelectPersona(null);
            }
        } catch (error) {
            showToast('Failed to delete persona', 'error');
        }
    };

    const handleSetDefault = async (id: string) => {
        try {
            await fetch(`/api/personas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isDefault: true })
            });
            showToast('Default persona updated', 'success');
            fetchPersonas();
        } catch (error) {
            showToast('Failed to update default', 'error');
        }
    };

    const handleGenerate = async () => {
        if (!genName.trim()) {
            showToast('Please enter a name for the persona', 'warning');
            return;
        }

        setIsGenerating(true);
        try {
            const res = await fetch('/api/personas/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: genName,
                    description: genDescription,
                    role: genRole,
                    vaultQuery: genVaultQuery,
                    fileNames: selectedFiles,
                    customContext: genCustomContext,
                })
            });

            const response: ApiResponse<Persona> = await res.json();

            if (response.success && response.data) {
                showToast(`Persona "${response.data.name}" created!`, 'success');
                fetchPersonas();
                setShowGenerator(false);
                resetGeneratorForm();
            } else {
                showToast(response.error || 'Failed to generate persona', 'error');
            }
        } catch (error) {
            console.error('Generation error:', error);
            showToast('Failed to generate persona', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const resetGeneratorForm = () => {
        setGenName('');
        setGenDescription('');
        setGenRole('');
        setGenVaultQuery('');
        setGenCustomContext('');
        setSelectedFiles([]);
    };

    const selectedPersona = personas.find(p => p.id === selectedPersonaId);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white hover:bg-white/5 gap-2"
                    title="Manage Personas"
                >
                    <div className="flex items-center gap-2">
                        {selectedPersona ? (
                            <>
                                <span className="text-lg">{selectedPersona.avatar || '🤖'}</span>
                                <span className="text-xs text-gray-400 max-w-[100px] truncate hidden sm:inline">
                                    {selectedPersona.name}
                                </span>
                            </>
                        ) : (
                            <>
                                <Users className="h-4 w-4" />
                                <span className="text-xs hidden sm:inline">Personas</span>
                            </>
                        )}
                    </div>
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[700px] bg-black/90 backdrop-blur-xl text-gray-100 border-white/10 max-h-[85vh]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        Persona Manager
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Create and manage AI personas for different conversation styles
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-4 mt-4">
                    {/* Persona List */}
                    <div className="w-1/2 border-r border-white/10 pr-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-300">Your Personas</h3>
                            <Button
                                onClick={() => setShowGenerator(true)}
                                size="sm"
                                className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                            >
                                <Sparkles className="w-3 h-3 mr-1" />
                                Create
                            </Button>
                        </div>

                        <ScrollArea className="h-[400px]">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                                </div>
                            ) : personas.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    No personas yet. Create one!
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <AnimatePresence>
                                        {personas.map(persona => (
                                            <motion.div
                                                key={persona.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                onClick={() => onSelectPersona(persona)}
                                                className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedPersonaId === persona.id
                                                    ? 'bg-purple-500/20 border-purple-500/30'
                                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl">{persona.avatar || '🤖'}</span>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium text-gray-200">
                                                                    {persona.name}
                                                                </span>
                                                                {persona.isDefault && (
                                                                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-400 line-clamp-1">
                                                                {persona.role}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSetDefault(persona.id);
                                                            }}
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-gray-500 hover:text-amber-400"
                                                            title="Set as default"
                                                        >
                                                            <Star className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(persona.id);
                                                            }}
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-gray-500 hover:text-red-400"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Details / Generator */}
                    <div className="w-1/2 pl-2">
                        {showGenerator ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" />
                                        AI-Powered Creation
                                    </h3>
                                    <Button
                                        onClick={() => {
                                            setShowGenerator(false);
                                            resetGeneratorForm();
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-gray-400"
                                    >
                                        Cancel
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-xs text-gray-400">Name *</Label>
                                        <Input
                                            value={genName}
                                            onChange={e => setGenName(e.target.value)}
                                            placeholder="e.g., Marcus (My Life Coach)"
                                            className="h-8 text-sm bg-white/5 border-white/10"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-xs text-gray-400">Role Hint</Label>
                                        <Input
                                            value={genRole}
                                            onChange={e => setGenRole(e.target.value)}
                                            placeholder="e.g., Life coach, Technical mentor"
                                            className="h-8 text-sm bg-white/5 border-white/10"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                                            <Search className="w-3 h-3" />
                                            Search Vault Query (Optional)
                                        </Label>
                                        <Input
                                            value={genVaultQuery}
                                            onChange={e => setGenVaultQuery(e.target.value)}
                                            placeholder="e.g., notes about John, my mentor"
                                            className="h-8 text-sm bg-white/5 border-white/10"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                                            <FileText className="w-3 h-3" />
                                            Select Vault Files ({selectedFiles.length})
                                        </Label>
                                        <ScrollArea className="h-40 border border-white/10 rounded-md bg-white/5 p-2">
                                            {vaultFiles.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-xs text-gray-500 gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin opacity-50" />
                                                    <span>Loading files...</span>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    {vaultFiles.map(file => (
                                                        <div
                                                            key={file.path}
                                                            onClick={() => toggleFileSelection(file.path)}
                                                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-all ${selectedFiles.includes(file.path)
                                                                    ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30'
                                                                    : 'hover:bg-white/10 text-gray-300 border border-transparent'
                                                                }`}
                                                        >
                                                            <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${selectedFiles.includes(file.path)
                                                                    ? 'border-purple-400 bg-purple-500'
                                                                    : 'border-gray-600 bg-transparent'
                                                                }`}>
                                                                {selectedFiles.includes(file.path) && <Check className="w-2.5 h-2.5 text-white" />}
                                                            </div>
                                                            <span className="truncate flex-1">{file.name}</span>
                                                            <span className="text-[10px] text-gray-600 font-mono opacity-50">{file.path}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </ScrollArea>
                                    </div>

                                    <div>
                                        <Label className="text-xs text-gray-400">Custom Context</Label>
                                        <textarea
                                            value={genCustomContext}
                                            onChange={e => setGenCustomContext(e.target.value)}
                                            placeholder="Add notes about this persona's personality, background, etc."
                                            className="w-full h-20 text-sm bg-white/5 border border-white/10 rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                        />
                                    </div>
                                </div>

                                <Button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !genName.trim()}
                                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating Persona...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Generate Persona
                                        </>
                                    )}
                                </Button>
                            </div>
                        ) : selectedPersona ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{selectedPersona.avatar}</span>
                                    <div>
                                        <h3 className="font-semibold text-gray-200">{selectedPersona.name}</h3>
                                        <p className="text-xs text-gray-400">{selectedPersona.role}</p>
                                    </div>
                                </div>

                                <p className="text-sm text-gray-300">{selectedPersona.description}</p>

                                {selectedPersona.objectives.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-purple-400 mb-1">Objectives</h4>
                                        <ul className="text-xs text-gray-400 space-y-1">
                                            {selectedPersona.objectives.slice(0, 3).map((obj, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <span className="text-purple-400">•</span>
                                                    {obj}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {selectedPersona.knowledgeBoundaries.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-purple-400 mb-1">Expertise</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedPersona.knowledgeBoundaries.map((topic, i) => (
                                                <span key={i} className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2 border-t border-white/10">
                                    <h4 className="text-xs font-semibold text-gray-400 mb-2">Tone</h4>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Formality:</span>
                                            <span className="text-gray-300 capitalize">{selectedPersona.tone.formality}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Warmth:</span>
                                            <span className="text-gray-300 capitalize">{selectedPersona.tone.warmth}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Directness:</span>
                                            <span className="text-gray-300 capitalize">{selectedPersona.tone.directness}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Verbosity:</span>
                                            <span className="text-gray-300 capitalize">{selectedPersona.tone.verbosity}</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedPersona.sourceFiles && selectedPersona.sourceFiles.length > 0 && (
                                    <div className="text-[10px] text-gray-500">
                                        Based on: {selectedPersona.sourceFiles.slice(0, 2).join(', ')}
                                        {selectedPersona.sourceFiles.length > 2 && ` +${selectedPersona.sourceFiles.length - 2} more`}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                                <Users className="w-12 h-12 mb-3 opacity-30" />
                                <p className="text-sm">Select a persona to view details</p>
                                <p className="text-xs mt-2">or create a new one</p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="mt-4 pt-4 border-t border-white/10">
                    <Button
                        onClick={() => setOpen(false)}
                        variant="ghost"
                        className="text-gray-400"
                    >
                        Close
                    </Button>
                    {selectedPersona && (
                        <Button
                            onClick={() => {
                                onSelectPersona(selectedPersona);
                                setOpen(false);
                            }}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            Use "{selectedPersona.name}"
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
