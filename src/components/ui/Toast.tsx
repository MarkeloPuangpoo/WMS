"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

// Types
type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
};

type ToastContextType = {
    toast: {
        success: (title: string, message?: string) => void;
        error: (title: string, message?: string) => void;
        warning: (title: string, message?: string) => void;
        info: (title: string, message?: string) => void;
    };
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx.toast;
}

// Config
const ICONS = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const STYLES = {
    success: {
        bg: "bg-emerald-50 border-emerald-200",
        icon: "text-emerald-500",
        title: "text-emerald-900",
        msg: "text-emerald-700",
        progress: "bg-emerald-400",
    },
    error: {
        bg: "bg-red-50 border-red-200",
        icon: "text-red-500",
        title: "text-red-900",
        msg: "text-red-700",
        progress: "bg-red-400",
    },
    warning: {
        bg: "bg-amber-50 border-amber-200",
        icon: "text-amber-500",
        title: "text-amber-900",
        msg: "text-amber-700",
        progress: "bg-amber-400",
    },
    info: {
        bg: "bg-blue-50 border-blue-200",
        icon: "text-blue-500",
        title: "text-blue-900",
        msg: "text-blue-700",
        progress: "bg-blue-400",
    },
};

const DEFAULT_DURATION: Record<ToastType, number> = {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3500,
};

// Individual Toast Item
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
    const style = STYLES[toast.type];
    const Icon = ICONS[toast.type];
    const duration = toast.duration ?? DEFAULT_DURATION[toast.type];
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const startTimeRef = useRef(Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);
            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 30);

        const timeout = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onDismiss(toast.id), 300);
        }, duration);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [duration, toast.id, onDismiss]);

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(() => onDismiss(toast.id), 300);
    };

    return (
        <div
            className={`relative overflow-hidden rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-300 ease-out ${style.bg}
                ${isExiting ? "opacity-0 translate-x-full scale-95" : "opacity-100 translate-x-0 scale-100"}
            `}
            style={{ animation: isExiting ? undefined : "toast-slide-in 0.4s cubic-bezier(0.21, 1.02, 0.73, 1)" }}
        >
            <div className="flex items-start gap-3 px-4 py-3.5 pr-10">
                <div className={`shrink-0 mt-0.5 ${style.icon}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-tight ${style.title}`}>{toast.title}</p>
                    {toast.message && (
                        <p className={`text-xs mt-1 leading-snug ${style.msg} opacity-80`}>{toast.message}</p>
                    )}
                </div>
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-0.5 rounded-full hover:bg-black/5 transition-colors"
                >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
            </div>
            {/* Progress bar */}
            <div className="h-0.5 w-full bg-black/5">
                <div
                    className={`h-full ${style.progress} transition-none`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}

// Provider
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((type: ToastType, title: string, message?: string) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setToasts(prev => [...prev, { id, type, title, message }]);
    }, []);

    const toast = {
        success: (title: string, message?: string) => addToast("success", title, message),
        error: (title: string, message?: string) => addToast("error", title, message),
        warning: (title: string, message?: string) => addToast("warning", title, message),
        info: (title: string, message?: string) => addToast("info", title, message),
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-[380px] max-w-[calc(100vw-2rem)] pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className="pointer-events-auto">
                        <ToastItem toast={t} onDismiss={dismiss} />
                    </div>
                ))}
            </div>

            {/* Keyframe animation */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes toast-slide-in {
                    0% { opacity: 0; transform: translateX(100%) scale(0.95); }
                    100% { opacity: 1; transform: translateX(0) scale(1); }
                }
            `}} />
        </ToastContext.Provider>
    );
}
