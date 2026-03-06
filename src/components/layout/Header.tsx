"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, ChevronRight, User, ChevronDown, Search, Menu } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function Header({ profile, onOpenSidebar }: { profile: any; onOpenSidebar?: () => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    // State สำหรับเปิด/ปิด Dropdown
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // ปิด Dropdown เมื่อคลิกที่อื่นบนหน้าจอ
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.refresh();
        router.push("/login");
    };

    // คำนวณเพื่อแสดงชื่อหน้าปัจจุบันบน Breadcrumb
    const paths = pathname.split('/').filter(Boolean);
    const currentPage = paths.length > 0
        ? paths[paths.length - 1].replace(/-/g, ' ')
        : 'Dashboard';

    // Dispatch custom event to open Command Palette
    const triggerSearch = () => {
        window.dispatchEvent(new CustomEvent("open-command-palette"));
    };

    return (
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
            {/* Left Section: Breadcrumb & Search */}
            <div className="flex items-center gap-3 sm:gap-6">
                {/* Mobile Menu Toggle */}
                <button
                    onClick={onOpenSidebar}
                    className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <Menu className="w-5 h-5" />
                </button>

                {/* Dynamic Breadcrumb */}
                <div className="flex items-center text-sm hidden sm:flex">
                    <span className="text-gray-500 font-medium whitespace-nowrap">Colamarc</span>
                    <ChevronRight className="w-4 h-4 mx-2 text-gray-400 shrink-0" />
                    <span className="font-semibold text-gray-900 capitalize whitespace-nowrap">{currentPage}</span>
                </div>

                {/* Search Trigger Button (Command Palette) */}
                <button
                    onClick={triggerSearch}
                    className="flex items-center text-sm text-gray-500 bg-gray-50/50 hover:bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5 transition-colors duration-200 min-w-[200px] justify-between group"
                >
                    <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
                        <span>Search...</span>
                    </div>
                    <kbd className="hidden sm:inline-flex items-center gap-1 font-sans text-[10px] font-medium text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </button>
            </div>

            {/* User Profile & Actions */}
            <div className="flex items-center gap-4">
                {profile ? (
                    <div className="relative" ref={dropdownRef}>
                        {/* Profile Button */}
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-gray-50 transition-colors duration-200 border border-transparent hover:border-gray-100"
                        >
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-semibold text-gray-900 leading-none">{profile.full_name}</p>
                                <p className="text-xs text-gray-500 mt-1.5">{profile.email}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-600 to-primary-400 flex items-center justify-center text-white font-bold shadow-sm ring-2 ring-white shrink-0">
                                {profile.full_name ? profile.full_name[0].toUpperCase() : <User className="w-4 h-4" />}
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                {/* Mobile User Info (แสดงเฉพาะมือถือเพราะข้างบนโดนซ่อนไว้) */}
                                <div className="px-4 py-3 border-b border-gray-100 sm:hidden mb-1">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{profile.full_name}</p>
                                    <p className="text-xs text-gray-500 truncate mt-0.5">{profile.email}</p>
                                </div>

                                {/* Logout Button */}
                                <div className="px-1.5">
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-2.5 transition-colors duration-200"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-gray-500 px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                        Not logged in
                    </div>
                )}
            </div>
        </header>
    );
}