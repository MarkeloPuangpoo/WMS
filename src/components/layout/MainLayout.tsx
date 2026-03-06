import { createClient } from "@/lib/supabase/server";
import ClientLayoutWrapper from "./ClientLayoutWrapper";

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
        <ClientLayoutWrapper profile={profile}>
            {children}
        </ClientLayoutWrapper>
    );
}