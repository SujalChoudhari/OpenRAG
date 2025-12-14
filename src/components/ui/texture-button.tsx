import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const textureButtonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    {
        variants: {
            variant: {
                default:
                    "bg-neutral-800/80 text-neutral-200 border border-white/10 hover:bg-neutral-700/80 hover:border-white/20 shadow-sm",
                accent:
                    "bg-gradient-to-r from-rose-600 to-amber-600 text-white border-0 shadow-lg shadow-rose-500/25 hover:from-rose-500 hover:to-amber-500 hover:shadow-rose-500/40",
                secondary:
                    "bg-neutral-700/50 text-neutral-300 border border-white/[0.06] hover:bg-neutral-600/50 hover:text-white shadow-sm",
                destructive:
                    "bg-red-600/20 text-red-400 border border-red-500/20 hover:bg-red-600/30 hover:text-red-300",
                ghost:
                    "bg-transparent text-neutral-400 hover:text-white hover:bg-white/[0.06]",
                minimal:
                    "bg-transparent text-neutral-500 hover:text-neutral-200",
                icon:
                    "bg-neutral-800/60 text-neutral-300 border border-white/[0.08] hover:bg-neutral-700/60 hover:border-white/15 shadow-sm",
                outline:
                    "border border-white/10 bg-transparent text-neutral-300 hover:bg-white/[0.06] hover:border-white/20 hover:text-white",
            },
            size: {
                default: "h-10 px-5 py-2",
                sm: "h-8 px-3 text-xs",
                lg: "h-12 px-8 text-base",
                icon: "h-10 w-10",
                "icon-sm": "h-8 w-8",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface TextureButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof textureButtonVariants> {
    asChild?: boolean
}

const TextureButton = React.forwardRef<HTMLButtonElement, TextureButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(textureButtonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
TextureButton.displayName = "TextureButton"

export { TextureButton, textureButtonVariants }
