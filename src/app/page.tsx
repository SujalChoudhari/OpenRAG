'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useChat } from 'ai/react'
import { AnimatePresence, motion } from 'framer-motion'
import { File, RefreshCcwIcon, Send, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from "react-markdown"
import { addContent, getFiles, removeFile } from './actions'

export default function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit,setMessages } = useChat({
    keepLastMessageOnError: true,
    onResponse: () => {
      setIsTyping(false);
    }
  });

  const [isTyping, setIsTyping] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [typingMessage, setTypingMessage] = useState<string>('');  // To store the random typing message
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmitWrapper = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim()) {
      const randomMessage = typingMessages[Math.floor(Math.random() * typingMessages.length)];
      setTypingMessage(randomMessage);
      setIsTyping(true);
      handleSubmit(e);
    }
  };

  useEffect(() => {
    const loadFiles = async () => {
      const newfiles = await getFiles();
      if (files.length == newfiles.length) return;
      setFiles(newfiles);
    };

    loadFiles();
  }, [files]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = event.target.files;

    if (newFiles) {
      const newFileNames = Array.from(newFiles).map(file => file.name);
      setFiles(prevFiles => [...prevFiles, ...newFileNames]);

      const filesWithContent = Array.from(newFiles).map(async file => {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });

        return { name: file.name, content };
      });

      const uploadedFiles = await Promise.all(filesWithContent);
      await addContent(uploadedFiles);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const deleteFile = (fileName: string) => {
    removeFile(fileName);
    setFiles(prevFiles => prevFiles.filter(file => file !== fileName));
  };

  const resetChat = () => {
    setFiles([]);
    setMessages([]);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 rounded-l-lg shadow-lg border-r border-gray-700 overflow-hidden">
        <div className="px-6 pt-6 bg-gray-800">
          <h2 className="text-xl font-bold text-cyan-400">Files in Database</h2>
        </div>
        <div className="p-6 bg-gray-800 border-b border-gray-700">
          <Button onClick={triggerFileUpload} className="bg-cyan-600 mr-2 hover:bg-cyan-700 text-white">
            <Upload className="mr-2 h-5 w-5" />
            Upload File
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            multiple
          />
        </div>
        <div className="p-6 space-y-4 overflow-y-auto h-[calc(100vh-250px)]">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between text-gray-300 bg-gray-700 p-2 rounded-md">
              <div className="flex items-center">
                <File className="mr-2 h-5 w-5 text-cyan-400" />
                <span className="text-sm">{file.length > 10 ? `${file.slice(0, 10)}...` : file}</span>
              </div>
              <Button
                onClick={() => deleteFile(file)}
                variant="ghost"
                size="icon"
                className="text-red-400 hover:text-red-300 hover:bg-gray-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 bg-gray-800 rounded-r-lg shadow-lg border-l-0 border-gray-700 overflow-hidden">
        <header className="p-6 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-cyan-400">OpenRAG</h1>
          <Button onClick={resetChat} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <RefreshCcwIcon className="h-5 w-5" />
          </Button>
        </header>

        <div className="h-[calc(100vh-14rem)] overflow-y-auto p-6 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map(message => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-end ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    className={`max-w-md mx-3 p-4 rounded-lg shadow-md ${message.role === 'user'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                      }`}
                  >
                    <Markdown className="text-sm">{message.content}</Markdown>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex justify-start"
            >
              <div className="flex items-end">
                <div >
                  <span className="text-sm text-gray-300 pl-4">{typingMessage}</span>
                  <div className="max-w-md mx-3 p-4 rounded-lg bg-gray-700 shadow-md">
                    <span className="flex space-x-2">
                      <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                      <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-75"></span>
                      <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-150"></span>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <form onSubmit={handleSubmitWrapper} className="p-6 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center space-x-3">
            <Input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={handleInputChange}
              className="flex-grow bg-gray-700 text-gray-100 text-sm placeholder-gray-400 border-cyan-600 focus:border-cyan-400 focus:ring-cyan-400"
            />
            <Button type="submit" size="icon" className="bg-cyan-600 hover:bg-cyan-700 text-white w-10 h-10">
              <Send className="h-5 w-5" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}