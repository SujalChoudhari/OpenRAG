'use client'

import { getFiles, removeFile } from './actions'
import { useChat } from 'ai/react'
import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { ChatArea } from '@/components/chat-area'

export default function ChatInterface() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [typingMessage, setTypingMessage] = useState<string>('');
  const [uploadLogs, setUploadLogs] = useState<string[]>([]);

  const { messages, input, handleInputChange, handleSubmit, setMessages, data } = useChat({
    keepLastMessageOnError: true,
    body: { sessionId },
    onResponse: (response) => {
      setIsTyping(false);
      const newSessionId = response.headers.get('X-Session-Id');
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId);
      }
    }
  });

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
    if (!newFiles || newFiles.length === 0) return;

    setUploadLogs([]);
    const formData = new FormData();
    Array.from(newFiles).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        setUploadLogs(prev => [...prev, ...lines]);
      }

      // Refresh file list
      const updatedFiles = await getFiles();
      setFiles(updatedFiles);

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadLogs(prev => [...prev, `Error: ${error}`]);
    }
  };

  const deleteFile = (fileName: string) => {
    removeFile(fileName);
    setFiles(prevFiles => prevFiles.filter(file => file !== fileName));
  };

  const resetChat = () => {
    setMessages([]);
    setIsTyping(false);
    setSessionId(null); // Clear session ID to start fresh
  };

  const loadSession = async (id: string) => {
    try {
      setMessages([]); // Clear current messages first
      setIsTyping(false);

      const res = await fetch(`/api/history/${id}`);
      if (res.ok) {
        const session = await res.json();
        setSessionId(session.id);
        // Small delay to ensure state updates don't conflict
        setTimeout(() => {
          setMessages(session.messages);
        }, 0);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-gray-100 font-sans selection:bg-rose-500/30">
      <Sidebar
        files={files}
        onUpload={handleFileUpload}
        onDelete={deleteFile}
        onReset={resetChat}
        onSelectSession={loadSession}
        currentSessionId={sessionId}
        uploadLogs={uploadLogs}
      />
      <ChatArea
        messages={messages}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmitWrapper}
        isTyping={isTyping}
        typingMessage={typingMessage}
        files={files}
        data={data}
      />
    </div>
  )
}