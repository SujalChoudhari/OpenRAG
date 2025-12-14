import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenRAG | Knowledge Base",
  description: "Your personal intelligence layer powered by RAG and Ollama.",
  keywords: ["RAG", "AI", "Ollama", "Second Brain", "Knowledge Base"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.className} antialiased bg-black text-white overflow-hidden`}>
        <ToastProvider >{children}</ToastProvider>
      </body>
    </html>
  );
}

