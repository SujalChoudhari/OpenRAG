'use client'

import { addContent, getFiles, removeFile } from './actions'
import { useChat } from 'ai/react'
import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { ChatArea } from '@/components/chat-area'

export default function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, setMessages } = useChat({
    keepLastMessageOnError: true,
    onResponse: () => {
      setIsTyping(false);
    }
  });

  const [isTyping, setIsTyping] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [typingMessage, setTypingMessage] = useState<string>('');

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

  const deleteFile = (fileName: string) => {
    removeFile(fileName);
    setFiles(prevFiles => prevFiles.filter(file => file !== fileName));
  };

  const resetChat = () => {
    setMessages([]);
    setIsTyping(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-cyan-500/30">
      <Sidebar
        files={files}
        onUpload={handleFileUpload}
        onDelete={deleteFile}
        onReset={resetChat}
      />
      <ChatArea
        messages={messages}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmitWrapper}
        isTyping={isTyping}
        typingMessage={typingMessage}
      />
    </div>
  )
}