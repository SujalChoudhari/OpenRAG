'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Message } from 'ai';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Bot, User, Brain, ChevronDown, ChevronRight, Sparkles, BookOpen } from 'lucide-react';
import Markdown from "react-markdown";
import { useEffect, useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatAreaProps {
    messages: Message[];
    input: string;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    isTyping: boolean;
    typingMessage: string;
    data?: any[];
    files?: string[];
}

// Helper to parse the XML structure
function parseAIResponse(content: string) {
    const thoughtMatch = content.match(/<thought_process>([\s\S]*?)<\/thought_process>/);
    const answerMatch = content.match(/<answer>([\s\S]*?)<\/answer>/);
    const questionsMatch = content.match(/<suggested_questions>([\s\S]*?)<\/suggested_questions>/);

    const thought = thoughtMatch ? thoughtMatch[1].trim() : null;
    let answer = answerMatch ? answerMatch[1].trim() : content;

    if (!answerMatch && thoughtMatch) {
        answer = content.replace(/<thought_process>[\s\S]*?<\/thought_process>/, '').trim();
    }

    answer = answer.replace(/<suggested_questions>[\s\S]*?<\/suggested_questions>/, '').trim();

    const questions: string[] = [];
    if (questionsMatch) {
        const qMatches = Array.from(questionsMatch[1].matchAll(/<q>(.*?)<\/q>/g));
        for (const match of qMatches) {
            questions.push(match[1]);
        }
    }

    return { thought, answer, questions };
}

export function ChatArea({
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isTyping,
    typingMessage,
    data,
    files = []
}: ChatAreaProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
    const [selectedSource, setSelectedSource] = useState<{ title: string; content: string } | null>(null);

    // Autocomplete state
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // Extract sources from data stream
    const sources = data?.find(d => d && (d as any).sources)?.sources || [];

    const toggleThought = (messageId: string) => {
        setExpandedThoughts(prev => ({
            ...prev,
            [messageId]: !prev[messageId]
        }));
    };

    useEffect(() => {
        if (scrollRef.current) {
            const scrollElement = scrollRef.current;
            const isNearBottom = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight < 100;
            if (isNearBottom) {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }
        }
    }, [messages, isTyping]);

    useEffect(() => {
        if (messages.length > 0 && messages[messages.length - 1].role === 'user' && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length]);

    const handleInputWrapper = (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const cursorPosition = e.target.selectionStart || 0;

        // Always update the input state first
        handleInputChange(e);

        // Check for @ trigger
        const lastAt = value.lastIndexOf('@', cursorPosition);
        if (lastAt !== -1 && lastAt < cursorPosition) {
            const query = value.slice(lastAt + 1, cursorPosition);
            // Only show if no space after @ (unless searching)
            if (!query.includes(' ')) {
                const matches = files.filter(f => f.toLowerCase().includes(query.toLowerCase()));
                if (matches.length > 0) {
                    setFilteredFiles(matches);
                    setShowSuggestions(true);
                    return;
                }
            }
        }

        setShowSuggestions(false);
    };

    const insertFile = (fileName: string) => {
        if (!inputRef.current) return;

        const value = input;
        const cursorPosition = inputRef.current.selectionStart || 0;
        const lastAt = value.lastIndexOf('@', cursorPosition);

        if (lastAt !== -1) {
            const newValue = value.slice(0, lastAt) + `@${fileName} ` + value.slice(cursorPosition);
            const newCursorPos = lastAt + fileName.length + 2; // +2 for @ and space

            // Create synthetic event
            const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            if (nativeInputSetter) {
                nativeInputSetter.call(inputRef.current, newValue);
                inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
            }

            setShowSuggestions(false);
            inputRef.current.focus();
            inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
    };

    const handleQuestionClick = (question: string) => {
        const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        const inputElement = document.querySelector('input[name="chat-input"]') as HTMLInputElement;

        if (inputElement && nativeInputSetter) {
            nativeInputSetter.call(inputElement, question);
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => {
                const form = inputElement.closest('form');
                form?.requestSubmit();
            }, 100);
        }
    };

    const renderAnswerWithCitations = (text: string, sources: any[]) => {
        // Split text by citation pattern [Source: X]
        const parts = text.split(/(\[Source: \d+\])/g);

        return parts.map((part, index) => {
            const match = part.match(/\[Source: (\d+)\]/);
            if (match) {
                const sourceIndex = parseInt(match[1]) - 1;
                const source = sources?.[sourceIndex];

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
            return <Markdown key={index} className="inline prose prose-invert prose-sm max-w-none" components={{
                p: ({ node, ...props }) => <span {...props} />, // Render paragraphs as spans to stay inline
                pre: ({ node: _node, ...props }) => <div className="overflow-auto w-full my-2 bg-black/30 p-2 rounded block" {...props as any} />,
                code: ({ node: _node, ...props }) => <code className="bg-black/30 px-1 py-0.5 rounded text-sm" {...props as any} />
            }}>{part}</Markdown>;
        });
    };

    return (
        <div className="flex-1 flex flex-col h-screen bg-black relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-rose-600/5 blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-amber-600/5 blur-[100px]" />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10 scroll-smooth" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 flex items-center justify-center border border-white/10 backdrop-blur-sm">
                            <Bot className="w-8 h-8 text-rose-400" />
                        </div>
                        <p className="text-lg font-medium">How can I help you today?</p>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {messages.map((message, index) => {
                        const isUser = message.role === 'user';
                        const { thought, answer, questions } = !isUser ? parseAIResponse(message.content) : { thought: null, answer: message.content, questions: [] };

                        // Check for sources in annotations (persisted) or data (streaming)
                        const annotation = message.annotations?.find((a: any) => a.type === 'sources') as any;
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
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-rose-600 ml-3' : 'bg-gray-800 mr-3'
                                        }`}>
                                        {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-rose-400" />}
                                    </div>

                                    <div className="flex flex-col space-y-2 w-full">
                                        {/* Sources Section (Collapsible) */}
                                        {!isUser && messageSources && messageSources.length > 0 && (
                                            <div className="bg-gray-900/50 border border-white/5 rounded-lg overflow-hidden mb-2">
                                                <button
                                                    onClick={() => toggleThought(`sources-${message.id}`)}
                                                    className="w-full flex items-center px-3 py-2 text-xs text-amber-500/80 hover:text-amber-500 hover:bg-white/5 transition-colors"
                                                >
                                                    <BookOpen className="w-3 h-3 mr-2" />
                                                    <span>Sources Used ({messageSources.length})</span>
                                                    {expandedThoughts[`sources-${message.id}`] ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
                                                </button>
                                                <AnimatePresence>
                                                    {expandedThoughts[`sources-${message.id}`] && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="px-3 pb-3 space-y-2"
                                                        >
                                                            <div className="text-xs text-gray-500 font-mono border-t border-white/5 pt-2">
                                                                {messageSources.map((source: any, idx: number) => (
                                                                    <div key={idx} className="mb-2 last:mb-0">
                                                                        <div className="font-semibold text-gray-400 mb-1">Source {idx + 1}</div>
                                                                        <div className="line-clamp-2">{source.text}</div>
                                                                        <button
                                                                            onClick={() => setSelectedSource({ title: `Source ${idx + 1}`, content: source.text })}
                                                                            className="text-rose-500 hover:underline mt-1"
                                                                        >
                                                                            View Full
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}

                                        {thought && (
                                            <div className="bg-gray-900/50 border border-white/5 rounded-lg overflow-hidden">
                                                <button
                                                    onClick={() => toggleThought(message.id)}
                                                    className="w-full flex items-center px-3 py-2 text-xs text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors"
                                                >
                                                    <Brain className="w-3 h-3 mr-2" />
                                                    <span>Thinking Process</span>
                                                    {expandedThoughts[message.id] ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
                                                </button>
                                                <AnimatePresence>
                                                    {expandedThoughts[message.id] && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="px-3 pb-3"
                                                        >
                                                            <div className="text-xs text-gray-500 font-mono border-t border-white/5 pt-2">
                                                                {thought}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}

                                        <div
                                            className={`p-4 rounded-2xl shadow-lg backdrop-blur-sm border ${isUser
                                                ? 'bg-rose-600/10 border-rose-500/20 text-rose-50 rounded-tr-none'
                                                : 'bg-gray-900/80 border-white/10 text-gray-100 rounded-tl-none'
                                                }`}
                                        >
                                            {isUser ? (
                                                <Markdown
                                                    className="prose prose-invert prose-sm max-w-none"
                                                    components={{
                                                        pre: ({ node: _node, ...props }) => <div className="overflow-auto w-full my-2 bg-black/30 p-2 rounded" {...props as any} />,
                                                        code: ({ node: _node, ...props }) => <code className="bg-black/30 px-1 py-0.5 rounded text-sm" {...props as any} />
                                                    }}
                                                >
                                                    {answer}
                                                </Markdown>
                                            ) : (
                                                <div>
                                                    {renderAnswerWithCitations(answer, messageSources || [])}
                                                </div>
                                            )}
                                        </div>

                                        {questions && questions.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {questions.map((q, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleQuestionClick(q)}
                                                        className="flex items-center px-3 py-1.5 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full hover:bg-amber-500/20 transition-colors"
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
                    })}
                </AnimatePresence>

                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-rose-400" />
                            </div>
                            <div className="flex flex-col space-y-1">
                                <div className="bg-gray-900/50 border border-white/10 px-4 py-3 rounded-2xl rounded-tl-none flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-xs text-gray-500 ml-1">{typingMessage}</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            <div className="p-6 bg-black/80 backdrop-blur-md border-t border-white/10 z-20 relative">
                {/* Suggestions Dropdown */}
                {showSuggestions && (
                    <div className="absolute bottom-full mb-2 left-6 w-64 bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                        <div className="p-2 text-xs text-gray-500 border-b border-white/5">Suggested Files</div>
                        <div className="max-h-48 overflow-y-auto">
                            {filteredFiles.map((file, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => insertFile(file)}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors flex items-center"
                                >
                                    <BookOpen className="w-3 h-3 mr-2 text-rose-400" />
                                    {file}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
                    <Input
                        ref={inputRef}
                        name="chat-input"
                        value={input}
                        onChange={handleInputWrapper}
                        placeholder="Ask anything about your documents... (Type @ to reference a file)"
                        className="w-full pl-6 pr-14 py-6 bg-gray-900/50 border-white/10 focus:border-rose-500/50 focus:ring-rose-500/20 rounded-full text-gray-100 placeholder:text-gray-500 shadow-inner"
                        autoComplete="off"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full w-10 h-10 bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
