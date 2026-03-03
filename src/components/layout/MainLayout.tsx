

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { createClient } from "@/lib/supabase/server";

export default async function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let profile = null;
    if (user) {
        const { data } = await supabase.from('user_profiles').select('full_name, role').eq('id', user.id).single();
        profile = {
            email: user.email,
            full_name: data?.full_name || "Unknown User",
            role: data?.role || "user",
        };
    }

    return (
        <div className="flex h-screen overflow-hidden bg-surface">
            <Sidebar role={profile?.role} />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header profile={profile} />
                <main className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
