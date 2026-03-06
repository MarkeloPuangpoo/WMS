"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { usePathname } from "next/navigation";

export default function ClientLayoutWrapper({
    children,
    profile
}: {
    children: React.ReactNode;
    profile: any;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar on navigation on mobile
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [pathname]);

    return (
        <div className="flex h-[100dvh] overflow-hidden bg-gray-50 text-gray-900 font-sans">
            {/* Mobile Nav Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar role={profile?.role} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative w-full">
                <Header profile={profile} onOpenSidebar={() => setIsSidebarOpen(true)} />

                <main className="flex-1 overflow-y-auto w-full relative">
                    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 w-full pb-24">
                        {children}
                    </div>
                </main>
            </div>

            <CommandPalette />
        </div>
    );
}
