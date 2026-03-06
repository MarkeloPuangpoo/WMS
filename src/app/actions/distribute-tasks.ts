"use server";

import { createClient } from "@supabase/supabase-js";

export async function autoDistributeTasks(authHeader: string) {
    // 1. Authenticate user
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

    if (profile?.role !== 'superadmin' && profile?.role !== 'sup') {
        return { success: false, error: "Forbidden: Managers only" };
    }

    // 2. Init Admin Client for updates
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Fetch all active pickers
    const { data: pickers, error: pickersError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, full_name')
        .eq('role', 'picker');

    if (pickersError || !pickers || pickers.length === 0) {
        return { success: false, error: "No active pickers found to distribute tasks to." };
    }

    // 4. Fetch all OPEN, unassigned pick lists
    const { data: unassignedTasks, error: tasksError } = await supabaseAdmin
        .from('pick_lists')
        .select('id')
        .eq('status', 'OPEN')
        .is('assigned_to', null)
        .order('created_at', { ascending: true });

    if (tasksError || !unassignedTasks || unassignedTasks.length === 0) {
        return { success: true, message: "No unassigned tasks to distribute.", assignedCount: 0 };
    }

    // 5. Round-Robin Distribution
    const updates = [];
    for (let i = 0; i < unassignedTasks.length; i++) {
        const pickerIndex = i % pickers.length;
        updates.push(
            supabaseAdmin
                .from('pick_lists')
                .update({ assigned_to: pickers[pickerIndex].id })
                .eq('id', unassignedTasks[i].id)
        );
    }

    // Execute all updates
    await Promise.all(updates);

    return {
        success: true,
        message: `Successfully distributed ${unassignedTasks.length} tasks among ${pickers.length} pickers.`,
        assignedCount: unassignedTasks.length
    };
}

export async function createWaveAction(authHeader: string, taskIds: string[], pickerId: string) {
    if (!taskIds || taskIds.length === 0) return { success: false, error: "No tasks selected." };
    if (!pickerId) return { success: false, error: "Please select a picker for this Wave." };

    const supabaseUser = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabaseUser.from('user_profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'superadmin' && profile?.role !== 'sup') {
        return { success: false, error: "Forbidden: Managers only" };
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Generate Wave Number
    const now = new Date();
    const waveNum = `WAVE-${now.getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

    // 2. Create wave_picks record
    const { data: newWave, error: waveErr } = await supabaseAdmin
        .from('wave_picks')
        .insert({
            wave_number: waveNum,
            assigned_to: pickerId,
            status: 'OPEN'
        })
        .select('id')
        .single();

    if (waveErr || !newWave) {
        console.error("Wave Creation Error:", waveErr);
        return { success: false, error: "Failed to create Wave Batch." };
    }

    // 3. Update the selected pick_lists to link them to this wave_id and the same picker
    const { error: updateErr } = await supabaseAdmin
        .from('pick_lists')
        .update({
            wave_id: newWave.id,
            assigned_to: pickerId
        })
        .in('id', taskIds);

    if (updateErr) {
        console.error("Pick List Update Error:", updateErr);
        return { success: false, error: "Failed to link tasks to Wave." };
    }

    return {
        success: true,
        message: `Wave ${waveNum} created with ${taskIds.length} tasks and assigned!`
    };
}
