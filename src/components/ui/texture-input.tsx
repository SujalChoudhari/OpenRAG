import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextureInputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const TextureInput = React.forwardRef<HTMLInputElement, TextureInputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-11 w-full rounded-xl px-4 py-2",
                    "bg-neutral-800/60 border border-white/[0.08]",
                    "text-sm text-neutral-100 placeholder:text-neutral-500",
                    "transition-all duration-200",
                    "hover:bg-neutral-800/80 hover:border-white/15",
                    "focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
TextureInput.displayName = "TextureInput"

export { TextureInput }
