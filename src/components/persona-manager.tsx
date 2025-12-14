'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextureButton } from "@/components/ui/texture-button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
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
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const { showToast } = useToast();

    // Generator state
    const [genName, setGenName] = useState('');
    const [genDescription, setGenDescription] = useState('');
    const [genRole, setGenRole] = useState('');
    const [genVaultQuery, setGenVaultQuery] = useState('');
    const [genCustomContext, setGenCustomContext] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

    // Edit state
    const [showEditor, setShowEditor] = useState(false);

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

    const toggleFileSelection = (filePath: string) => {
        setSelectedFiles(prev =>
            prev.includes(filePath)
                ? prev.filter(f => f !== filePath)
                : [...prev, filePath]
        );
    };

    const handleDeleteClick = (id: string) => {
        setPendingDeleteId(id);
        setDeleteModalOpen(true);
    };

    const confirmDeletePersona = async () => {
        if (!pendingDeleteId) return;
        try {
            await fetch(`/api/personas/${pendingDeleteId}`, { method: 'DELETE' });
            showToast('Persona deleted', 'success');
            fetchPersonas();
            if (selectedPersonaId === pendingDeleteId) {
                onSelectPersona(null);
            }
        } catch {
            showToast('Failed to delete persona', 'error');
        } finally {
            setDeleteModalOpen(false);
            setPendingDeleteId(null);
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
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-neutral-400 hover:text-white hover:bg-white/5 gap-2"
                        title="Manage Personas"
                    >
                        <div className="flex items-center gap-2">
                            {selectedPersona ? (
                                <>
                                    <span className="text-lg">{selectedPersona.avatar || '🤖'}</span>
                                    <span className="text-xs text-neutral-400 max-w-[100px] truncate hidden sm:inline">
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

                <DialogContent className="sm:max-w-[900px] bg-[#080808]/95 backdrop-blur-xl text-neutral-100 border-white/[0.08] max-h-[85vh] shadow-glow flex flex-col overflow-hidden p-6">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle className="text-xl font-bold bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent flex items-center gap-2">
                            <Users className="w-5 h-5 text-rose-400" />
                            Persona Manager
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            Create and manage AI personas for different conversation styles
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mt-6 flex-1 min-h-0 overflow-hidden">
                        {/* Persona List */}
                        <div className="sm:w-[45%] sm:border-r border-white/[0.08] sm:pr-6 flex flex-col min-h-[180px] sm:min-h-0">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-neutral-300">Your Personas</h3>
                                <TextureButton
                                    onClick={() => setShowGenerator(true)}
                                    size="sm"
                                    variant="accent"
                                    className="h-7 text-xs"
                                >
                                    <Sparkles className="w-3 h-3 mr-1.5" />
                                    Create New
                                </TextureButton>
                            </div>

                            <ScrollArea className="flex-1 -mr-3 pr-3">
                                {loading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
                                    </div>
                                ) : personas.length === 0 ? (
                                    <div className="text-center py-12 text-neutral-500 text-sm border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        No personas yet.<br />Create one to get started!
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
                                                    className={`group p-3 rounded-xl cursor-pointer transition-all border ${selectedPersonaId === persona.id
                                                        ? 'bg-gradient-to-r from-rose-500/10 to-amber-500/10 border-rose-500/20 shadow-sm'
                                                        : 'bg-white/[0.03] border-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.06]'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-gradient-to-br flex-shrink-0 ${selectedPersonaId === persona.id ? 'from-rose-500/20 to-amber-500/20' : 'from-white/5 to-white/10'}`}>
                                                            {persona.avatar || '🤖'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-medium truncate ${selectedPersonaId === persona.id ? 'text-white' : 'text-neutral-300'}`}>
                                                                    {persona.name}
                                                                </span>
                                                                {persona.isDefault && (
                                                                    <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
                                                                {persona.role}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSetDefault(persona.id);
                                                                }}
                                                                className={`p-1.5 rounded-md transition-colors ${persona.isDefault
                                                                    ? 'text-amber-400 cursor-default'
                                                                    : 'text-neutral-600 hover:text-amber-400 hover:bg-amber-400/10'}`}
                                                                title={persona.isDefault ? 'Default persona' : 'Set as default'}
                                                                disabled={persona.isDefault}
                                                            >
                                                                <Star className={`w-3.5 h-3.5 ${persona.isDefault ? 'fill-amber-400' : ''}`} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingPersona(persona);
                                                                    setShowEditor(true);
                                                                }}
                                                                className="p-1.5 rounded-md text-neutral-600 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                                                                title="Edit persona"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteClick(persona.id);
                                                                }}
                                                                className="p-1.5 rounded-md text-neutral-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                                                title="Delete persona"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
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
                        <div className="sm:w-[55%] flex flex-col min-h-[180px] sm:min-h-0 border-t sm:border-t-0 border-white/[0.08] pt-4 sm:pt-0">
                            {showGenerator ? (
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" />
                                            AI-Powered Creation
                                        </h3>
                                        <TextureButton
                                            onClick={() => {
                                                setShowGenerator(false);
                                                resetGeneratorForm();
                                            }}
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-neutral-400"
                                        >
                                            Cancel
                                        </TextureButton>
                                    </div>

                                    <ScrollArea className="flex-1 -mr-3 pr-3">
                                        <div className="space-y-4 pb-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-neutral-400 font-medium">Name *</Label>
                                                <Input
                                                    value={genName}
                                                    onChange={e => setGenName(e.target.value)}
                                                    placeholder="e.g., Marcus (My Life Coach)"
                                                    className="h-9 text-sm bg-black/20 border-white/[0.08] focus:border-rose-500/50"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-neutral-400 font-medium">Role Hint</Label>
                                                <Input
                                                    value={genRole}
                                                    onChange={e => setGenRole(e.target.value)}
                                                    placeholder="e.g., Life coach, Technical mentor"
                                                    className="h-9 text-sm bg-black/20 border-white/[0.08] focus:border-rose-500/50"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-neutral-400 font-medium flex items-center gap-1.5">
                                                    <Search className="w-3 h-3" />
                                                    Search Vault Query (Optional)
                                                </Label>
                                                <Input
                                                    value={genVaultQuery}
                                                    onChange={e => setGenVaultQuery(e.target.value)}
                                                    placeholder="e.g., notes about John, my mentor"
                                                    className="h-9 text-sm bg-black/20 border-white/[0.08] focus:border-rose-500/50"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-neutral-400 font-medium flex items-center gap-1.5">
                                                    <FileText className="w-3 h-3" />
                                                    Select Vault Files ({selectedFiles.length})
                                                </Label>
                                                <ScrollArea className="h-32 border border-white/[0.08] rounded-xl bg-black/20 p-2">
                                                    {vaultFiles.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center h-full text-xs text-neutral-500 gap-2">
                                                            <Loader2 className="w-4 h-4 animate-spin opacity-50" />
                                                            <span>Loading files...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            {vaultFiles.map(file => (
                                                                <div
                                                                    key={file.path}
                                                                    onClick={() => toggleFileSelection(file.path)}
                                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-all ${selectedFiles.includes(file.path)
                                                                        ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30'
                                                                        : 'hover:bg-white/5 text-neutral-300 border border-transparent'
                                                                        }`}
                                                                >
                                                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${selectedFiles.includes(file.path)
                                                                        ? 'border-rose-500 bg-rose-500 text-white'
                                                                        : 'border-neutral-600 bg-transparent'
                                                                        }`}>
                                                                        {selectedFiles.includes(file.path) && <Check className="w-2.5 h-2.5" />}
                                                                    </div>
                                                                    <span className="truncate flex-1">{file.name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </ScrollArea>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-neutral-400 font-medium">Custom Context</Label>
                                                <textarea
                                                    value={genCustomContext}
                                                    onChange={e => setGenCustomContext(e.target.value)}
                                                    placeholder="Add notes about this persona's personality, background, etc."
                                                    className="w-full h-20 text-sm bg-black/20 border border-white/[0.08] rounded-xl p-3 resize-none focus:outline-none focus:ring-1 focus:ring-rose-500/50 text-neutral-100 placeholder:text-neutral-600"
                                                />
                                            </div>
                                        </div>
                                    </ScrollArea>

                                    <div className="mt-4 pt-4 border-t border-white/[0.08]">
                                        <TextureButton
                                            onClick={handleGenerate}
                                            disabled={isGenerating || !genName.trim()}
                                            variant="accent"
                                            className="w-full"
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
                                        </TextureButton>
                                    </div>
                                </div>
                            ) : showEditor && editingPersona ? (
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                                            <Edit2 className="w-4 h-4" />
                                            Edit Persona
                                        </h3>
                                        <TextureButton
                                            onClick={() => {
                                                setShowEditor(false);
                                                setEditingPersona(null);
                                            }}
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-neutral-400"
                                        >
                                            Cancel
                                        </TextureButton>
                                    </div>

                                    <ScrollArea className="flex-1 -mr-3 pr-3">
                                        <div className="space-y-4 pb-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-neutral-400 font-medium">Name</Label>
                                                <Input
                                                    value={editingPersona.name}
                                                    onChange={e => setEditingPersona({ ...editingPersona, name: e.target.value })}
                                                    className="h-9 text-sm bg-black/20 border-white/[0.08] focus:border-blue-500/50"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-neutral-400 font-medium">Avatar (emoji)</Label>
                                                <Input
                                                    value={editingPersona.avatar || ''}
                                                    onChange={e => setEditingPersona({ ...editingPersona, avatar: e.target.value })}
                                                    placeholder="🤖"
                                                    className="h-9 text-sm bg-black/20 border-white/[0.08] focus:border-blue-500/50"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-neutral-400 font-medium">Role</Label>
                                                <Input
                                                    value={editingPersona.role}
                                                    onChange={e => setEditingPersona({ ...editingPersona, role: e.target.value })}
                                                    className="h-9 text-sm bg-black/20 border-white/[0.08] focus:border-blue-500/50"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-neutral-400 font-medium">Description</Label>
                                                <textarea
                                                    value={editingPersona.description}
                                                    onChange={e => setEditingPersona({ ...editingPersona, description: e.target.value })}
                                                    className="w-full h-24 text-sm bg-black/20 border border-white/[0.08] rounded-xl p-3 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-neutral-100"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs text-neutral-400 font-medium">Tone</Label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {(['formality', 'warmth', 'directness', 'verbosity'] as const).map(toneKey => {
                                                        const options = {
                                                            formality: ['casual', 'neutral', 'formal', 'professional'],
                                                            warmth: ['cold', 'neutral', 'warm', 'enthusiastic'],
                                                            directness: ['indirect', 'balanced', 'direct', 'blunt'],
                                                            verbosity: ['concise', 'balanced', 'detailed', 'verbose']
                                                        };
                                                        return (
                                                            <div key={toneKey} className="space-y-1">
                                                                <span className="text-[10px] text-neutral-500 capitalize">{toneKey}</span>
                                                                <select
                                                                    value={editingPersona.tone[toneKey]}
                                                                    onChange={e => setEditingPersona({
                                                                        ...editingPersona,
                                                                        tone: { ...editingPersona.tone, [toneKey]: e.target.value }
                                                                    })}
                                                                    className="w-full h-8 text-xs bg-black/30 border border-white/[0.08] rounded-lg px-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                                                >
                                                                    {options[toneKey].map(opt => (
                                                                        <option key={opt} value={opt}>{opt}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </ScrollArea>

                                    <div className="mt-4 pt-4 border-t border-white/[0.08]">
                                        <TextureButton
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch(`/api/personas/${editingPersona.id}`, {
                                                        method: 'PUT',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify(editingPersona)
                                                    });
                                                    if (res.ok) {
                                                        showToast('Persona updated!', 'success');
                                                        fetchPersonas();
                                                        setShowEditor(false);
                                                        setEditingPersona(null);
                                                    } else {
                                                        showToast('Failed to save changes', 'error');
                                                    }
                                                } catch {
                                                    showToast('Failed to save changes', 'error');
                                                }
                                            }}
                                            variant="accent"
                                            className="w-full bg-blue-600 hover:bg-blue-700"
                                        >
                                            <Check className="w-4 h-4 mr-2" />
                                            Save Changes
                                        </TextureButton>
                                    </div>
                                </div>
                            ) : selectedPersona ? (
                                <div className="h-full flex flex-col">
                                    <ScrollArea className="flex-1 -mr-3 pr-3">
                                        <div className="space-y-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-white/10 flex items-center justify-center text-4xl shadow-glow">
                                                    {selectedPersona.avatar}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-white">{selectedPersona.name}</h3>
                                                    <p className="text-sm text-rose-400">{selectedPersona.role}</p>
                                                </div>
                                            </div>

                                            <div className="glass-card p-3 rounded-xl bg-white/[0.02]">
                                                <p className="text-sm text-neutral-300 leading-relaxed">{selectedPersona.description}</p>
                                            </div>

                                            {selectedPersona.objectives.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Objectives</h4>
                                                    <ul className="space-y-2">
                                                        {selectedPersona.objectives.slice(0, 3).map((obj, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                                                                {obj}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {selectedPersona.knowledgeBoundaries.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Expertise</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedPersona.knowledgeBoundaries.map((topic, i) => (
                                                            <span key={i} className="text-xs px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-lg">
                                                                {topic}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="pt-4 border-t border-white/[0.08]">
                                                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Tone Analysis</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {Object.entries(selectedPersona.tone).map(([key, value]) => (
                                                        <div key={key} className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                                                            <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{key}</span>
                                                            <span className="block text-sm text-neutral-200 capitalize font-medium">{value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {selectedPersona.sourceFiles && selectedPersona.sourceFiles.length > 0 && (
                                                <div className="text-xs text-neutral-500 flex items-center gap-2 bg-white/[0.02] p-2 rounded-lg">
                                                    <FileText className="w-3 h-3" />
                                                    Based on: {selectedPersona.sourceFiles.slice(0, 2).join(', ')}
                                                    {selectedPersona.sourceFiles.length > 2 && ` +${selectedPersona.sourceFiles.length - 2} more`}
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center text-neutral-500">
                                    <div className="w-20 h-20 rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
                                        <Users className="w-10 h-10 opacity-30" />
                                    </div>
                                    <p className="text-base font-medium text-neutral-300">No Persona Selected</p>
                                    <p className="text-sm mt-1 max-w-[200px]">Select a persona from the list or create a new one to get started.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t border-white/[0.08] flex flex-row gap-2 justify-end">
                        <TextureButton
                            onClick={() => setOpen(false)}
                            variant="ghost"
                            className="text-neutral-400"
                        >
                            Close
                        </TextureButton>
                        {selectedPersona && (
                            <TextureButton
                                onClick={() => {
                                    onSelectPersona(selectedPersona);
                                    setOpen(false);
                                }}
                                variant="default"
                                className="bg-white text-black hover:bg-neutral-200"
                            >
                                Use "{selectedPersona.name}"
                            </TextureButton>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmModal
                open={deleteModalOpen}
                onConfirm={confirmDeletePersona}
                onCancel={() => { setDeleteModalOpen(false); setPendingDeleteId(null); }}
                title="Delete Persona"
                description="Are you sure you want to delete this persona? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
            />
        </>
    );
}
