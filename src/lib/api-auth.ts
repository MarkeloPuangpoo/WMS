import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

// Create a server-role client to bypass RLS for API key checking
// This is necessary because the incoming request won't have a user session
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Needs service_role key to read api_keys table safely
);

export async function verifyApiKey(): Promise<{ isValid: boolean; error?: string }> {
    try {
        const headersList = await headers();
        const authHeader = headersList.get("authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { isValid: false, error: "Missing or invalid Authorization header. Expected Bearer <token>" };
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return { isValid: false, error: "Empty token provided" };
        }

        // In a real production system, you would hash the incoming token and compare it 
        // to `key_hash` in the database. For this MVP, we are doing a direct comparison 
        // against `key_hash` for simplicity, assuming the provided token IS the hash for now.
        // We also check that the key is ACTIVE.

        const { data, error } = await supabaseAdmin
            .from("api_keys")
            .select("id, status")
            .eq("key_hash", token)
            .eq("status", "ACTIVE")
            .single();

        if (error || !data) {
            return { isValid: false, error: "Invalid or revoked API Key" };
        }

        // Optional: Update last_used_at timestamp asynchronously (don't await to block the request)
        supabaseAdmin
            .from("api_keys")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", data.id)
            .then();

        return { isValid: true };
    } catch (err) {
        console.error("API Key Verification Error:", err);
        return { isValid: false, error: "Internal server error during authentication" };
    }
}
