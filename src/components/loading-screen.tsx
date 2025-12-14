'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface LoadingScreenProps {
    message?: string;
    subMessage?: string;
}

export function LoadingScreen({
    message = 'Loading...',
    subMessage
}: LoadingScreenProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-50"
        >
            {/* Subtle gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-amber-500/5" />

            {/* Content */}
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative flex flex-col items-center"
            >
                {/* Logo with pulse animation */}
                <div className="relative mb-8">
                    <motion.div
                        className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center"
                        animate={{
                            boxShadow: [
                                '0 0 20px rgba(244, 63, 94, 0.2)',
                                '0 0 40px rgba(244, 63, 94, 0.4)',
                                '0 0 20px rgba(244, 63, 94, 0.2)'
                            ]
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Image
                            src="/logo.png"
                            alt="OpenRAG"
                            width={80}
                            height={80}
                            className="object-cover"
                        />
                    </motion.div>
                </div>

                {/* Message */}
                <h2 className="text-lg font-medium text-white mb-2">
                    {message}
                </h2>

                {subMessage && (
                    <p className="text-sm text-neutral-500">
                        {subMessage}
                    </p>
                )}

                {/* Simple loading bar */}
                <div className="mt-6 w-48 h-1 bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-rose-500 to-amber-500"
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ width: '50%' }}
                    />
                </div>
            </motion.div>
        </motion.div>
    );
}
