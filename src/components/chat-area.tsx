'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Message } from 'ai';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Bot, User } from 'lucide-react';
import Markdown from "react-markdown";
import { useEffect, useRef } from 'react';

interface ChatAreaProps {
    messages: Message[];
    input: string;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    isTyping: boolean;
    typingMessage: string;
}

export function ChatArea({
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isTyping,
    typingMessage
}: ChatAreaProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    return (
        <div className="flex-1 flex flex-col h-screen bg-gray-950 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/5 blur-[100px]" />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center border border-white/10 backdrop-blur-sm">
                            <Bot className="w-8 h-8 text-cyan-400" />
                        </div>
                        <p className="text-lg font-medium">How can I help you today?</p>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {messages.map(message => (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`flex items-start max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.role === 'user' ? 'bg-cyan-600 ml-3' : 'bg-gray-700 mr-3'
                                    }`}>
                                    {message.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-cyan-400" />}
                                </div>

                                <div
                                    className={`p-4 rounded-2xl shadow-lg backdrop-blur-sm border ${message.role === 'user'
                                        ? 'bg-cyan-600/10 border-cyan-500/20 text-cyan-50 rounded-tr-none'
                                        : 'bg-gray-800/80 border-white/10 text-gray-100 rounded-tl-none'
                                        }`}
                                >
                                    <Markdown
                                        className="prose prose-invert prose-sm max-w-none"
                                        components={{
                                            pre: ({ node: _node, ...props }) => <div className="overflow-auto w-full my-2 bg-black/30 p-2 rounded" {...props as any} />,
                                            code: ({ node: _node, ...props }) => <code className="bg-black/30 px-1 py-0.5 rounded text-sm" {...props as any} />
                                        }}
                                    >
                                        {message.content}
                                    </Markdown>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div className="flex flex-col space-y-1">
                                <div className="bg-gray-800/50 border border-white/10 px-4 py-3 rounded-2xl rounded-tl-none flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-xs text-gray-500 ml-1">{typingMessage}</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            <div className="p-6 bg-gray-900/80 backdrop-blur-md border-t border-white/10 z-20">
                <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
                    <Input
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Ask anything about your documents..."
                        className="w-full pl-6 pr-14 py-6 bg-gray-800/50 border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-full text-gray-100 placeholder:text-gray-500 shadow-inner"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full w-10 h-10 bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
