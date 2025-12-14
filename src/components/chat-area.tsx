'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextureButton } from "@/components/ui/texture-button";
import { Message } from 'ai';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Bot, User, Brain, ChevronDown, ChevronRight, Sparkles, BookOpen, Database, AlertCircle, PanelLeft, CheckCircle2, FileText, Search, Loader2 } from 'lucide-react';
import Markdown from "react-markdown";
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SelectedPersona {
    id: string;
    name: string;
    avatar?: string;
    role: string;
}

interface ChatAreaProps {
    messages: Message[];
    input: string;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    isTyping: boolean;
    typingMessage: string;
    data?: unknown[];
    files?: string[];
    personaSelector?: React.ReactNode;
    selectedPersona?: SelectedPersona | null;
    sidebarCollapsed?: boolean;
    onToggleSidebar?: () => void;
    streamingThinking?: string;
    setInput?: (value: string) => void;
}

interface ParsedResponse {
    thought: string | null;
    answer: string;
    questions: string[];
}

/**
 * Parse AI response content, handling various formats:
 * - Standard responses
 * - XML-structured responses with <thought_process>, <answer>, <suggested_questions>
 * - Thinking model responses with <thinking> or <think> tags
 */
function parseAIResponse(content: string): ParsedResponse {
    // Try multiple thinking tag formats (thinking models use different tags)
    const thinkingPatterns = [
        /<thought_process>([\s\S]*?)<\/thought_process>/,
        /<thinking>([\s\S]*?)<\/thinking>/,
        /<think>([\s\S]*?)<\/think>/,
    ];

    let thought: string | null = null;
    let processedContent = content;

    // Find and extract thinking content
    for (const pattern of thinkingPatterns) {
        const match = content.match(pattern);
        if (match) {
            thought = match[1].trim();
            processedContent = content.replace(pattern, '').trim();
            break;
        }
    }

    // If no complete thinking block, check for open thinking block (streaming)
    if (!thought) {
        const openTags = ['<thought_process>', '<thinking>', '<think>'];
        for (const tag of openTags) {
            if (content.includes(tag)) {
                // Check if it's closed
                const closeTag = tag.replace('<', '</');
                if (!content.includes(closeTag)) {
                    // It's an open, streaming thought
                    const parts = content.split(tag);
                    if (parts.length > 1) {
                        // Everything after the tag is the thought so far
                        thought = parts[1].trim();
                        // Ideally we hide the thought from the main answer while it's streaming
                        // But for now, let's just make sure we capture it.
                        // Actually, if we're in "thought mode", the whole content IS the thought.
                        // But we want to separate it.

                        // If we're streaming and only have the thought, answer is empty
                        processedContent = parts[0].trim();
                    }
                }
            }
        }
    }

    // Try to extract structured answer
    const answerMatch = processedContent.match(/<answer>([\s\S]*?)<\/answer>/);
    let answer = answerMatch ? answerMatch[1].trim() : processedContent;

    // Clean up any remaining thought tags from answer
    answer = answer
        .replace(/<thought_process>[\s\S]*?<\/thought_process>/g, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim();

    // Extract suggested questions
    const questionsMatch = answer.match(/<suggested_questions>([\s\S]*?)<\/suggested_questions>/);
    const questions: string[] = [];

    if (questionsMatch) {
        const qMatches = Array.from(questionsMatch[1].matchAll(/<q>(.*?)<\/q>/g));
        for (const match of qMatches) {
            questions.push(match[1].trim());
        }
        // Remove questions from answer
        answer = answer.replace(/<suggested_questions>[\s\S]*?<\/suggested_questions>/, '').trim();
    }

    // Clean up any leading/trailing whitespace and empty lines
    answer = answer.replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');

    return { thought, answer, questions };
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

interface SourceData {
    id?: string;
    text: string;
    similarity?: number;
}

export function ChatArea({
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isTyping,
    typingMessage,
    data,
    files = [],
    personaSelector,
    selectedPersona,
    sidebarCollapsed = false,
    onToggleSidebar,
    streamingThinking = '',
    setInput
}: ChatAreaProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
    const [selectedSource, setSelectedSource] = useState<{ title: string; content: string } | null>(null);
    const [thinkingCollapsed, setThinkingCollapsed] = useState(false);

    // Detect when thinking is done from server signal
    const thinkingDone = useMemo(() => {
        if (!data || data.length === 0) return false;
        return data.some((item: any) => item?.thinkingDone === true);
    }, [data]);

    // Auto-collapse thinking when done
    useEffect(() => {
        if (thinkingDone && !thinkingCollapsed) {
            setThinkingCollapsed(true);
        }
    }, [thinkingDone, thinkingCollapsed]);

    // Reset thinking state when new message starts
    useEffect(() => {
        if (isTyping && streamingThinking === '') {
            setThinkingCollapsed(false);
        }
    }, [isTyping, streamingThinking]);

    // Debug: Log streamingThinking changes
    useEffect(() => {
        if (streamingThinking) {
            console.log('🧠 ChatArea streamingThinking:', streamingThinking.slice(-50));
        }
    }, [streamingThinking]);

    // Extract RAG status from streaming data
    const ragStatus = useMemo(() => {
        if (!data || data.length === 0) return null;
        // Last item might be the status object or partial data
        // We look for the status object specifically
        const statusItem = data.find((item: any) => item?.ragStatus) as any;
        return statusItem?.ragStatus || null;
    }, [data]);

    // Autocomplete state
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [autocompleteQuery, setAutocompleteQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Debounce autocomplete query
    const debouncedQuery = useDebounce(autocompleteQuery, 150);

    // Memoize filtered files
    const filteredFiles = useMemo(() => {
        if (!debouncedQuery) return files;
        return files.filter(f => f.toLowerCase().includes(debouncedQuery.toLowerCase()));
    }, [files, debouncedQuery]);

    // Extract sources from data stream - memoized
    const { sources } = useMemo(() => {
        const sourceData = data?.find(d => d && (d as { sources?: SourceData[] }).sources) as { sources: SourceData[] } | undefined;
        return {
            sources: sourceData?.sources || []
        };
    }, [data]);

    const toggleThought = useCallback((messageId: string) => {
        setExpandedThoughts(prev => ({
            ...prev,
            [messageId]: !prev[messageId]
        }));
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            const scrollElement = scrollRef.current;
            const isNearBottom = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight < 100;
            if (isNearBottom) {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }
        }
    }, [messages, isTyping]);

    // Scroll to bottom on new user message
    useEffect(() => {
        if (messages.length > 0 && messages[messages.length - 1].role === 'user' && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length, messages]);

    const handleInputWrapper = useCallback((e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const cursorPosition = (e.target as HTMLInputElement).selectionStart || 0;

        // Always update the input state first
        handleInputChange(e);

        // Check for @ trigger
        const lastAt = value.lastIndexOf('@', cursorPosition);
        if (lastAt !== -1 && lastAt < cursorPosition) {
            const query = value.slice(lastAt + 1, cursorPosition);
            // Only show if no space after @ (unless searching)
            if (!query.includes(' ')) {
                setAutocompleteQuery(query);
                setShowSuggestions(true);
                return;
            }
        }

        setShowSuggestions(false);
        setAutocompleteQuery('');
    }, [handleInputChange]);

    const insertFile = useCallback((fileName: string) => {
        if (!inputRef.current) return;

        const value = input;
        const cursorPosition = inputRef.current.selectionStart || 0;
        const lastAt = value.lastIndexOf('@', cursorPosition);

        if (lastAt !== -1) {
            const newValue = value.slice(0, lastAt) + `@${fileName} ` + value.slice(cursorPosition);
            const newCursorPos = lastAt + fileName.length + 2;

            // Use setInput if available (React-friendly), fallback to synthetic event
            if (setInput) {
                setInput(newValue);
            } else {
                // Create a synthetic event for controlled input
                const syntheticEvent = {
                    target: { value: newValue },
                    currentTarget: { value: newValue }
                } as React.ChangeEvent<HTMLInputElement>;
                handleInputChange(syntheticEvent);
            }

            setShowSuggestions(false);
            setAutocompleteQuery('');
            inputRef.current.focus();
            requestAnimationFrame(() => {
                inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
            });
        }
    }, [input, setInput, handleInputChange]);

    const handleQuestionClick = useCallback((question: string) => {
        // Use setInput if available (React-friendly approach)
        if (setInput) {
            setInput(question);
            // Submit after state update
            setTimeout(() => {
                const form = document.querySelector('form');
                form?.requestSubmit();
            }, 100);
        } else {
            // Fallback: create synthetic event
            const syntheticEvent = {
                target: { value: question },
                currentTarget: { value: question }
            } as React.ChangeEvent<HTMLInputElement>;
            handleInputChange(syntheticEvent);
            setTimeout(() => {
                const form = document.querySelector('form');
                form?.requestSubmit();
            }, 100);
        }
    }, [setInput, handleInputChange]);

    // Memoized citation renderer
    const renderAnswerWithCitations = useCallback((text: string, messageSources: SourceData[]) => {
        const parts = text.split(/(\[Source: \d+\])/g);

        return parts.map((part, index) => {
            const match = part.match(/\[Source: (\d+)\]/);
            if (match) {
                const sourceIndex = parseInt(match[1]) - 1;
                const source = messageSources?.[sourceIndex];

                if (source) {
                    return (
                        <button
                            key={index}
                            onClick={() => setSelectedSource({ title: `Source ${sourceIndex + 1}`, content: source.text })}
                            className="inline-flex items-center mx-1 px-1.5 py-0.5 rounded text-xs font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer"
                            title="Click to view source"
                        >
                            <BookOpen className="w-3 h-3 mr-1" />
                            {sourceIndex + 1}
                        </button>
                    );
                }
                return <span key={index} className="text-gray-500 text-xs">[{sourceIndex + 1}]</span>;
            }
            return (
                <Markdown
                    key={index}
                    className="inline prose prose-invert prose-sm max-w-none"
                    components={{
                        p: ({ children }) => <span>{children}</span>,
                        pre: ({ children }) => <div className="overflow-auto w-full my-2 bg-black/30 p-2 rounded block">{children}</div>,
                        code: ({ children, className }) => <code className={`bg-black/30 px-1 py-0.5 rounded text-sm ${className || ''}`}>{children}</code>
                    }}
                >
                    {part}
                </Markdown>
            );
        });
    }, []);

    // Memoized message rendering
    const renderedMessages = useMemo(() => {
        return messages.map((message, index) => {
            const isUser = message.role === 'user';
            const { thought, answer, questions } = !isUser ? parseAIResponse(message.content) : { thought: null, answer: message.content, questions: [] };

            // Check for sources in annotations (persisted) or data (streaming)
            const annotation = message.annotations?.find((a: unknown) => (a as { type?: string }).type === 'sources') as { sources?: SourceData[] } | undefined;
            const messageSources = annotation?.sources || (index === messages.length - 1 ? sources : []);

            return (
                <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                    <div className={`flex items-start max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-rose-600 ml-3' : 'bg-gray-800 mr-3'}`}>
                            {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-rose-400" />}
                        </div>

                        <div className="flex flex-col space-y-2 w-full">
                            {/* Sources Section (Card Style) */}
                            {!isUser && messageSources && messageSources.length > 0 && (
                                <div className="mb-2">
                                    <button
                                        onClick={() => toggleThought(`sources-${message.id}`)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-full transition-colors w-fit transition-all"
                                    >
                                        <BookOpen className="w-3 h-3" />
                                        <span>{messageSources.length} Sources Found</span>
                                        {expandedThoughts[`sources-${message.id}`] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </button>
                                    <AnimatePresence>
                                        {expandedThoughts[`sources-${message.id}`] && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2"
                                            >
                                                {messageSources.map((source, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="glass-card p-3 rounded-xl border border-white/5 hover:border-amber-500/30 transition-colors cursor-pointer group"
                                                        onClick={() => setSelectedSource({ title: `Source ${idx + 1}`, content: source.text })}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-1.5 text-amber-500">
                                                                <FileText className="w-3 h-3" />
                                                                <span className="text-xs font-bold">Source {idx + 1}</span>
                                                            </div>
                                                            {source.similarity && (
                                                                <span className="text-[10px] text-neutral-500 bg-white/5 px-1.5 py-0.5 rounded">
                                                                    {Math.round(source.similarity * 100)}% Match
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                                                            {source.text}
                                                        </p>
                                                        <div className="flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-[10px] text-rose-400 hover:text-rose-300">View Full</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {thought && (
                                <div className="mb-2 w-full max-w-full">
                                    {(expandedThoughts[message.id] || (isTyping && index === messages.length - 1 && !answer)) ? (
                                        <div className="glass-panel bg-black/40 border border-rose-500/10 rounded-2xl rounded-tl-none p-4 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex items-center gap-2 text-rose-400/70 mb-2 select-none">
                                                <Brain className={`w-3 h-3 ${isTyping && index === messages.length - 1 && !answer ? 'animate-pulse' : ''}`} />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Thinking Process</span>
                                                <button
                                                    onClick={() => toggleThought(message.id)}
                                                    className="ml-auto hover:bg-white/10 p-1 rounded transition-colors"
                                                >
                                                    <ChevronDown className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div className="font-mono text-xs text-gray-400 whitespace-pre-wrap leading-relaxed opacity-90">
                                                {thought}
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => toggleThought(message.id)}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-500/70 hover:text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-full transition-all w-fit mb-2"
                                        >
                                            <Brain className="w-3 h-3" />
                                            <span>Show Thinking Process</span>
                                            <ChevronRight className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {(answer || (!thought && !isTyping) || (!thought && isTyping)) && (
                                <div
                                    className={`p-4 rounded-2xl shadow-lg backdrop-blur-sm border ${isUser
                                        ? 'bg-gradient-to-br from-rose-600/15 to-amber-600/10 border-rose-500/20 text-neutral-100 rounded-tr-none'
                                        : 'glass-card text-neutral-100 rounded-tl-none ring-1 ring-white/5'
                                        }`}
                                >
                                    {isUser ? (
                                        <Markdown
                                            className="prose prose-invert prose-sm max-w-none"
                                            components={{
                                                pre: ({ children }) => <div className="overflow-auto w-full my-2 bg-black/30 p-2 rounded">{children}</div>,
                                                code: ({ children, className }) => <code className={`bg-black/30 px-1 py-0.5 rounded text-sm ${className || ''}`}>{children}</code>
                                            }}
                                        >
                                            {answer}
                                        </Markdown>
                                    ) : (
                                        <div>
                                            {renderAnswerWithCitations(answer, messageSources || [])}
                                            {isTyping && index === messages.length - 1 && !answer && (
                                                <span className="inline-block w-1.5 h-4 bg-rose-500/50 align-middle animate-pulse ml-1" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {questions && questions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {questions.map((q, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleQuestionClick(q)}
                                            className="flex items-center px-3 py-1.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full hover:bg-amber-500/20 transition-all duration-200"
                                        >
                                            <Sparkles className="w-3 h-3 mr-1.5" />
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            );
        });
    }, [messages, sources, expandedThoughts, toggleThought, renderAnswerWithCitations, handleQuestionClick]);

    return (
        <div className="flex-1 flex flex-col h-screen bg-[#050505] relative overflow-hidden">
            {/* Background gradient glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-rose-600/[0.04] blur-[120px]" />
                <div className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-amber-600/[0.04] blur-[120px]" />
            </div>

            {/* Persona Header Bar */}
            {personaSelector && (
                <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.05] bg-black/60 backdrop-blur-xl z-20">
                    <div className="flex items-center gap-3">
                        {sidebarCollapsed && (
                            <TextureButton
                                onClick={onToggleSidebar}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg mr-1 text-neutral-400 hover:text-white"
                                title="Expand Sidebar"
                            >
                                <PanelLeft className="h-4 w-4" />
                            </TextureButton>
                        )}
                        {selectedPersona && (
                            <>
                                <span className="text-xl">{selectedPersona.avatar || '🤖'}</span>
                                <div>
                                    <div className="text-sm font-medium text-gray-200">{selectedPersona.name}</div>
                                    <div className="text-xs text-gray-500">{selectedPersona.role}</div>
                                </div>
                            </>
                        )}
                    </div>
                    {personaSelector}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10 scroll-smooth" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-5">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 flex items-center justify-center border border-white/[0.08] shadow-glow text-5xl">
                            {selectedPersona?.avatar || '🤖'}
                        </div>
                        <p className="text-lg font-medium text-neutral-200">
                            {selectedPersona ? `Chat with ${selectedPersona.name}` : 'How can I help you today?'}
                        </p>
                        {selectedPersona && (
                            <p className="text-sm text-neutral-500 max-w-md text-center">
                                {selectedPersona.role}
                            </p>
                        )}
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {renderedMessages}
                </AnimatePresence>

                {/* Streaming Thinking Bubble - shows when AI is thinking in real-time */}
                {streamingThinking && !thinkingCollapsed && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                    >
                        <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 rounded-full bg-neutral-800/80 flex items-center justify-center border border-white/[0.06]">
                                <Brain className="w-5 h-5 text-rose-400 animate-pulse" />
                            </div>
                            <div className="glass-panel bg-black/40 border border-rose-500/10 rounded-2xl rounded-tl-none p-4 max-w-[85%] relative overflow-hidden">
                                <div className="flex items-center gap-2 text-rose-400/70 mb-2 select-none">
                                    <Brain className="w-3 h-3 animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Thinking...</span>
                                    <button
                                        onClick={() => setThinkingCollapsed(true)}
                                        className="ml-auto hover:bg-white/10 p-1 rounded transition-colors"
                                    >
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="font-mono text-xs text-gray-400 whitespace-pre-wrap leading-relaxed opacity-90 max-h-48 overflow-y-auto">
                                    {streamingThinking}
                                    <span className="inline-block w-1.5 h-4 bg-rose-500/50 align-middle animate-pulse ml-1" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Collapsed thinking indicator */}
                {streamingThinking && thinkingCollapsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                    >
                        <button
                            onClick={() => setThinkingCollapsed(false)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-500/70 hover:text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-full transition-all ml-11"
                        >
                            <Brain className="w-3 h-3 animate-pulse" />
                            <span>Thinking... (click to expand)</span>
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </motion.div>
                )}

                {/* Only show typing indicator if there's no assistant message streaming content yet */}
                {isTyping && (messages.length === 0 || messages[messages.length - 1].role === 'user') && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-neutral-800/80 flex items-center justify-center border border-white/[0.06]">
                                <Bot className="w-5 h-5 text-rose-400" />
                            </div>
                            <div className="flex flex-col space-y-1">
                                <div className="glass-card px-4 py-3 rounded-2xl rounded-tl-none flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-gradient-to-r from-rose-400 to-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-gradient-to-r from-rose-400 to-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-gradient-to-r from-rose-400 to-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-xs text-neutral-500 ml-1">{typingMessage}</span>
                                {/* RAG Status Indicator */}
                                {ragStatus && (
                                    <div className={`flex items-center gap-1.5 text-xs ml-1 ${ragStatus.error ? 'text-red-400' : ragStatus.found > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        <Database className="w-3 h-3" />
                                        {ragStatus.error ? (
                                            <span>Search failed: {ragStatus.error}</span>
                                        ) : ragStatus.found > 0 ? (
                                            <span>Found {ragStatus.found} sources from vault</span>
                                        ) : (
                                            <span>No matching context found</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            <div className="p-6 bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-white/[0.05] z-20 relative texture-noise">
                {/* Suggestions Dropdown */}
                <AnimatePresence>
                    {showSuggestions && filteredFiles.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full mb-2 left-6 w-64 glass-card rounded-xl shadow-2xl overflow-hidden z-50"
                        >
                            <div className="p-2.5 text-xs text-neutral-500 border-b border-white/[0.06] font-medium">Suggested Files</div>
                            <div className="max-h-48 overflow-y-auto">
                                {filteredFiles.map((file, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => insertFile(file)}
                                        className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/[0.06] transition-colors flex items-center"
                                    >
                                        <BookOpen className="w-3 h-3 mr-2 text-rose-400" />
                                        {file}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {(ragStatus || isTyping) && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none z-0"
                        >
                            <div className="bg-[#0a0a0a]/90 backdrop-blur border border-white/10 shadow-glow px-4 py-1.5 rounded-full flex items-center gap-3 text-xs">
                                {ragStatus?.searched ? (
                                    <>
                                        {ragStatus.found > 0 ? (
                                            <span className="text-emerald-400 flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Found {ragStatus.found} sources
                                            </span>
                                        ) : (
                                            <span className="text-amber-400 flex items-center gap-1.5">
                                                <AlertCircle className="w-3 h-3" />
                                                No relevant sources found
                                            </span>
                                        )}
                                        <span className="w-px h-3 bg-white/10" />
                                    </>
                                ) : (ragStatus && !ragStatus.searched) ? (
                                    <>
                                        <span className="text-rose-400 flex items-center gap-1.5">
                                            <Search className="w-3 h-3 animate-pulse" />
                                            Searching knowledge base...
                                        </span>
                                        <span className="w-px h-3 bg-white/10" />
                                    </>
                                ) : null}

                                {isTyping ? (
                                    <span className="text-neutral-300 flex items-center gap-1.5">
                                        <Loader2 className="w-3 h-3 animate-spin text-rose-500" />
                                        Generating response...
                                    </span>
                                ) : (
                                    <span className="text-neutral-500">Ready</span>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative group z-10">
                    <Input
                        ref={inputRef}
                        name="chat-input"
                        value={input}
                        onChange={handleInputWrapper}
                        placeholder="Ask anything about your life... (Type @ to reference)"
                        className="w-full pl-6 pr-14 py-7 bg-neutral-900/80 border-white/[0.08] focus:border-rose-500/40 focus:ring-rose-500/20 rounded-2xl text-neutral-100 placeholder:text-neutral-500 shadow-glow transition-all hover:bg-neutral-900 hover:border-white/15"
                        autoComplete="off"
                        disabled={isTyping}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={!input.trim() || isTyping}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl w-10 h-10 bg-gradient-to-tr from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>

            <Dialog open={!!selectedSource} onOpenChange={(open) => !open && setSelectedSource(null)}>
                <DialogContent className="bg-gray-900 border-white/10 text-gray-100 max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedSource?.title}</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Source content used for this answer.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] mt-4 rounded-md border border-white/5 bg-black/30 p-4">
                        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300">
                            {selectedSource?.content}
                        </pre>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}
