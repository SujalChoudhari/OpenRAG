'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Check, AlertCircle, Loader2, Sparkles, Cpu, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface OnboardingScreenProps {
    onComplete: () => void;
}

interface Model {
    name: string;
    size?: string;
}

const steps = [
    { id: 1, label: 'Welcome' },
    { id: 2, label: 'Knowledge Base' },
    { id: 3, label: 'Models' },
    { id: 4, label: 'Complete' }
];

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [vaultPath, setVaultPath] = useState('');
    const [chatModel, setChatModel] = useState('');
    const [embeddingModel, setEmbeddingModel] = useState('');
    const [models, setModels] = useState<Model[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingModels, setLoadingModels] = useState(false);

    // Function to load models
    const loadModels = async () => {
        setLoadingModels(true);
        setError(null);
        try {
            const res = await fetch('/api/models');
            const data = await res.json();
            if (data.success && data.models) {
                setModels(data.models);
                if (data.models.length > 0) {
                    setChatModel(data.models[0].name);
                    setEmbeddingModel(data.models[0].name);
                }
            } else {
                setError('No models found. Pull a model with: ollama pull llama3.2');
            }
        } catch {
            setError('Could not connect to Ollama. Make sure Ollama is running.');
        } finally {
            setLoadingModels(false);
        }
    };

    // Load models when entering step 3
    useEffect(() => {
        if (currentStep === 3 && models.length === 0) {
            loadModels();
        }
    }, [currentStep]);

    const handleNext = () => {
        setError(null);
        if (currentStep < 4) setCurrentStep(currentStep + 1);
    };

    const handleBack = () => {
        setError(null);
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const handleComplete = async () => {
        setSaving(true);
        setError(null);

        try {
            // Get current settings
            const settingsRes = await fetch('/api/settings');
            const settingsData = await settingsRes.json();

            // Update settings with onboardingCompleted flag
            const updateRes = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...settingsData.data,
                    vaultPath: vaultPath.trim() || settingsData.data?.vaultPath || '',
                    chatModel: chatModel || settingsData.data?.chatModel || 'qwen3:0.6b',
                    embeddingModel: embeddingModel || settingsData.data?.embeddingModel || 'nomic-embed-text',
                    onboardingCompleted: true
                })
            });

            const updateData = await updateRes.json();
            if (!updateData.success) throw new Error(updateData.error || 'Failed to save');

            onComplete();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#0a0a0a] overflow-y-auto">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-amber-500/5 pointer-events-none" />

            <div className="relative z-10 min-h-full flex flex-col items-center justify-center p-8">
                {/* Logo */}
                <div className="mb-4">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center">
                        <Image src="/logo.png" alt="OpenRAG" width={80} height={80} className="object-cover" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gradient mb-2">Welcome to OpenRAG</h1>
                <p className="text-neutral-400 mb-8">Your AI-powered knowledge assistant</p>

                {/* Step Card */}
                <div className="w-full max-w-2xl">
                    <div className="rounded-[28px] bg-neutral-800/50 p-1">
                        <div className="rounded-[24px] bg-neutral-900 p-6">

                            {/* Step Indicators */}
                            <div className="flex items-center justify-center gap-2 mb-8">
                                {steps.map((step) => (
                                    <button
                                        key={step.id}
                                        onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all",
                                            step.id === currentStep
                                                ? "bg-white/10 text-white"
                                                : step.id < currentStep
                                                    ? "text-green-400 cursor-pointer"
                                                    : "text-neutral-500 cursor-default"
                                        )}
                                    >
                                        {step.id < currentStep ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <span className={cn(
                                                "w-5 h-5 rounded-full flex items-center justify-center text-xs border",
                                                step.id === currentStep ? "border-green-500 text-green-500" : "border-neutral-600"
                                            )}>
                                                {step.id}
                                            </span>
                                        )}
                                        <span>{step.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Step Content */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="min-h-[250px]"
                                >
                                    {currentStep === 1 && (
                                        <div className="text-center py-8">
                                            <Sparkles className="w-12 h-12 mx-auto mb-4 text-amber-400" />
                                            <h2 className="text-2xl font-bold text-white mb-3">Let's get you set up</h2>
                                            <p className="text-neutral-400 max-w-md mx-auto">
                                                We'll help you connect your knowledge base and configure your AI models in just a few steps.
                                            </p>
                                        </div>
                                    )}

                                    {currentStep === 2 && (
                                        <div className="py-4">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 flex items-center justify-center">
                                                    <FolderOpen className="w-6 h-6 text-rose-400" />
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-bold text-white">Knowledge Base</h2>
                                                    <p className="text-neutral-400 text-sm">Connect your Obsidian vault or markdown folder</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-neutral-300 mb-2">Vault Path</label>
                                                    <Input
                                                        value={vaultPath}
                                                        onChange={(e) => { setVaultPath(e.target.value); setError(null); }}
                                                        placeholder="C:\Users\You\Documents\ObsidianVault"
                                                        className="bg-black/30 border-white/10 h-12"
                                                    />
                                                    <p className="text-xs text-neutral-500 mt-2">Enter the full path to your markdown files folder</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 3 && (
                                        <div className="py-4">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                                    <Cpu className="w-6 h-6 text-purple-400" />
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-bold text-white">AI Models</h2>
                                                    <p className="text-neutral-400 text-sm">Choose your Ollama models</p>
                                                </div>
                                            </div>

                                            {loadingModels ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                                                </div>
                                            ) : models.length === 0 ? (
                                                <div className="text-center py-8">
                                                    <p className="text-neutral-400 mb-4">No models found. Make sure Ollama is running.</p>
                                                    <Button
                                                        onClick={loadModels}
                                                        variant="outline"
                                                        className="border-white/10 hover:bg-white/5"
                                                    >
                                                        <RefreshCw className="w-4 h-4 mr-2" />
                                                        Refresh
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-neutral-300 mb-2">Chat Model</label>
                                                        <select
                                                            value={chatModel}
                                                            onChange={(e) => setChatModel(e.target.value)}
                                                            className="w-full h-12 bg-neutral-900 border border-white/10 rounded-lg px-4 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                                                            style={{ colorScheme: 'dark' }}
                                                        >
                                                            {models.map(m => (
                                                                <option key={m.name} value={m.name} className="bg-neutral-900 text-white py-2">{m.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-neutral-300 mb-2">Embedding Model</label>
                                                        <select
                                                            value={embeddingModel}
                                                            onChange={(e) => setEmbeddingModel(e.target.value)}
                                                            className="w-full h-12 bg-neutral-900 border border-white/10 rounded-lg px-4 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                                                            style={{ colorScheme: 'dark' }}
                                                        >
                                                            {models.map(m => (
                                                                <option key={m.name} value={m.name} className="bg-neutral-900 text-white py-2">{m.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {currentStep === 4 && (
                                        <div className="text-center py-8">
                                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                                <Check className="w-8 h-8 text-green-400" />
                                            </div>
                                            <h2 className="text-2xl font-bold text-white mb-3">You're all set!</h2>
                                            <p className="text-neutral-400 max-w-md mx-auto">
                                                Click finish to start using OpenRAG with your knowledge base.
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                    <AlertCircle className="w-4 h-4" />{error}
                                </div>
                            )}

                            {/* Navigation */}
                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                <Button
                                    onClick={handleBack}
                                    variant="ghost"
                                    disabled={currentStep === 1}
                                    className="text-neutral-400"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                                </Button>

                                {currentStep === 2 && (
                                    <button onClick={handleNext} className="text-sm text-neutral-500 hover:text-neutral-300">
                                        Skip for now
                                    </button>
                                )}

                                {currentStep < 4 ? (
                                    <Button
                                        onClick={handleNext}
                                        className="bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600"
                                    >
                                        {currentStep === 1 ? 'Get Started' : 'Next'} <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleComplete}
                                        disabled={saving}
                                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                                        Finish
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Skip all */}
                <button onClick={onComplete} className="mt-6 text-sm text-neutral-500 hover:text-neutral-300">
                    Skip setup entirely
                </button>
            </div>
        </div>
    );
}
