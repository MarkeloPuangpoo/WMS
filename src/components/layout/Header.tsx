"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function Header({ profile }: { profile: any }) {
    const router = useRouter();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.refresh();
        router.push("/login");
    };

    return (
        <header className="h-16 bg-white border-b border-border-light flex items-center justify-between px-6 z-10 sticky top-0">
            <div className="flex items-center text-sm text-foreground">
                <span className="font-semibold">colamarc</span>
                <span className="mx-2 text-border-light">/</span>
                <span className="text-primary-600">Inventory</span>
            </div>

            <div className="flex items-center gap-4">
                {profile ? (
                    <div className="flex items-center border-l border-border-light pl-4 ml-2">
                        <div className="text-right mr-3">
                            <p className="text-sm font-medium text-foreground leading-none">{profile.full_name}</p>
                            <p className="text-xs text-primary-600 mt-1">{profile.email}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold shadow-sm">
                            {profile.full_name ? profile.full_name[0].toUpperCase() : "U"}
                        </div>
                        <button 
                            onClick={handleSignOut}
                            className="ml-4 p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                            title="Sign out"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    <div className="text-sm text-gray-500">Not logged in</div>
                )}
            </div>
        </header>
    );
}
