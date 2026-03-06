"use server";

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// We use service role key here to insert into api_keys
// But we must STILL verify the caller is a superadmin using their current auth token.
export async function generateApiKey(name: string, authHeader: string) {
    if (!name) return { success: false, error: "Name is required" };

    // 1. Verify caller is superadmin
    const supabaseUser = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabaseUser
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'superadmin') {
        return { success: false, error: "Forbidden: Superadmin only" };
    }

    // 2. Generate secure token
    // Format: cm_live_ + 32-char hex string
    const rawToken = "cm_live_" + crypto.randomBytes(16).toString('hex');
    const prefix = rawToken.substring(0, 12) + "..."; // cm_live_abcd...

    // For this MVP, we are storing the token as-is in `key_hash` for simplicity.
    // In production, `key_hash` should be crypto.createHash('sha256').update(rawToken).digest('hex')
    const keyHashToStore = rawToken;

    // 3. Insert using Admin client
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
        .from('api_keys')
        .insert({
            name,
            key_hash: keyHashToStore,
            prefix,
            status: 'ACTIVE',
            created_by: user.id
        })
        .select('id')
        .single();

    if (error) {
        console.error("Error creating API key:", error);
        return { success: false, error: "Failed to create API key" };
    }

    return {
        success: true,
        data: {
            id: data.id,
            rawToken: rawToken, // This is the ONLY time this will be returned
        }
    };
}
