'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FeatureStep {
    title: string;
    description: string;
    content?: React.ReactNode;
}

interface FeatureCarouselProps {
    steps: FeatureStep[];
    className?: string;
    bgClass?: string;
}

export function FeatureCarousel({ steps, className, bgClass = "bg-gradient-to-tr from-neutral-900/90 to-neutral-800/90" }: FeatureCarouselProps) {
    const [currentStep, setCurrentStep] = useState(0);

    return (
        <div className={cn("w-full", className)}>
            {/* Outer rounded container */}
            <div className="rounded-[34px] bg-neutral-700 p-2">
                <div className={cn("relative z-10 rounded-[28px] p-6", bgClass)}>

                    {/* Step indicators */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        {steps.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentStep(idx)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all",
                                    idx === currentStep
                                        ? "bg-white/10 text-white"
                                        : idx < currentStep
                                            ? "text-green-400"
                                            : "text-neutral-500"
                                )}
                            >
                                {idx < currentStep ? (
                                    <Check className="w-3 h-3" />
                                ) : (
                                    <span className={cn(
                                        "w-5 h-5 rounded-full flex items-center justify-center text-xs border",
                                        idx === currentStep
                                            ? "border-green-500 text-green-500"
                                            : "border-neutral-600"
                                    )}>
                                        {idx + 1}
                                    </span>
                                )}
                                <span>Step {idx + 1}</span>
                            </button>
                        ))}
                    </div>

                    {/* Content area */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Title and description */}
                            <div className="mb-6">
                                <h3 className="text-2xl font-bold text-white italic mb-2">
                                    {steps[currentStep].title}
                                </h3>
                                <p className="text-green-400 text-sm">
                                    {steps[currentStep].description}
                                </p>
                            </div>

                            {/* Image/content preview area */}
                            <div className="relative h-[200px] rounded-2xl bg-neutral-950 border border-neutral-800 overflow-hidden">
                                {steps[currentStep].content || (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-neutral-600 text-sm">Preview area</div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
