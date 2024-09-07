'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from 'ai/react'
import { Send, ArrowDown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion, AnimatePresence } from 'framer-motion'
import Markdown from "react-markdown"

export default function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    keepLastMessageOnError: true,
  })

  const [isTyping, setIsTyping] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const handleSubmitWrapper = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (input.trim()) {
      setIsTyping(true)
      handleSubmit(e)
      setTimeout(() => setIsTyping(false), Math.random() * 1000 + 500) // Simulate typing
    }
  }

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  useEffect(() => {
    const handleScroll = () => {
      if (scrollAreaRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 1
        setShowScrollButton(!isAtBottom)
      }
    }

    const scrollArea = scrollAreaRef.current
    if (scrollArea) {
      scrollArea.addEventListener('scroll', handleScroll)
    }

    return () => {
      if (scrollArea) {
        scrollArea.removeEventListener('scroll', handleScroll)
      }
    }
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 p-8">
      <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-lg border-4 border-gray-700 overflow-hidden">
        <header className="p-6 bg-gray-800 border-b border-gray-700">
          <h1 className="text-3xl font-bold text-gray-100">Chat Interface</h1>
        </header>

        <div className="relative">
          <ScrollArea className="h-[calc(100vh-14rem)] p-6" ref={scrollAreaRef}>
            <AnimatePresence initial={false}>
              {messages.map(message => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-6`}
                >
                  <div className={`flex items-end ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar className="w-12 h-12">
                      <AvatarFallback>{message.role === 'user' ? 'U' : 'AI'}</AvatarFallback>
                      <AvatarImage src={message.role === 'user' ? "/placeholder-user.jpg" : "/placeholder-ai.jpg"} />
                    </Avatar>
                    <div
                      className={`max-w-md mx-3 p-5 rounded-lg shadow-md ${message.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-100'
                        }`}
                    >
                      <Markdown className="text-lg">{message.content}</Markdown>
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
                className="flex justify-start mb-6"
              >
                <div className="flex items-end">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback>AI</AvatarFallback>
                    <AvatarImage src="/placeholder-ai.jpg" />
                  </Avatar>
                  <div className="max-w-md mx-3 p-5 rounded-lg bg-gray-700 shadow-md">
                    <span className="typing-indicator">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </ScrollArea>

          <AnimatePresence>
            {showScrollButton && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
              >
                <Button
                  onClick={scrollToBottom}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-4 py-2 shadow-lg flex items-center space-x-2"
                >
                  <ArrowDown className="h-4 w-4" />
                  <span>Scroll to Bottom</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <form onSubmit={handleSubmitWrapper} className="p-6 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center space-x-3">
            <Input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={handleInputChange}
              className="flex-grow bg-gray-700 text-gray-100 text-lg placeholder-gray-400"
            />
            <Button type="submit" size="icon" className="bg-purple-600 hover:bg-purple-700 text-white w-12 h-12">
              <Send className="h-6 w-6" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 