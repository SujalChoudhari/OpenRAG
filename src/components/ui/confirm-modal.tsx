"use client"

import * as React from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Trash2, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfirmModalProps {
    open: boolean
    onConfirm: () => void
    onCancel: () => void
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info'
    isLoading?: boolean
}

const variantConfig = {
    danger: {
        icon: Trash2,
        iconClass: "text-red-400",
        bgClass: "bg-red-500/10 border-red-500/20",
        buttonClass: "bg-red-600 hover:bg-red-500 text-white",
    },
    warning: {
        icon: AlertTriangle,
        iconClass: "text-amber-400",
        bgClass: "bg-amber-500/10 border-amber-500/20",
        buttonClass: "bg-amber-600 hover:bg-amber-500 text-white",
    },
    info: {
        icon: Info,
        iconClass: "text-blue-400",
        bgClass: "bg-blue-500/10 border-blue-500/20",
        buttonClass: "bg-blue-600 hover:bg-blue-500 text-white",
    },
}

export function ConfirmModal({
    open,
    onConfirm,
    onCancel,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = 'info',
    isLoading = false,
}: ConfirmModalProps) {
    const config = variantConfig[variant]
    const Icon = config.icon

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border",
                            config.bgClass
                        )}>
                            <Icon className={cn("w-5 h-5", config.iconClass)} />
                        </div>
                        <DialogTitle className="text-white">{title}</DialogTitle>
                    </div>
                    <DialogDescription className="text-neutral-400 pt-2">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 mt-4">
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        disabled={isLoading}
                        className="text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={cn(config.buttonClass, "min-w-[100px]")}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </span>
                        ) : confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
