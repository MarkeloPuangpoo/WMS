-- Phase 11: Wave & Batch Picking Migration
-- 1. Create the wave_picks table
CREATE TABLE IF NOT EXISTS public.wave_picks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wave_number VARCHAR(255) UNIQUE NOT NULL,
    -- e.g. WAVE-2026-001
    assigned_to UUID REFERENCES public.user_profiles(id),
    -- Picker assigned to the wave
    status VARCHAR(50) DEFAULT 'OPEN' CHECK (
        status IN (
            'OPEN',
            'IN_PROGRESS',
            'PICKED',
            'COMPLETED',
            'CANCELLED'
        )
    ),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS (Row Level Security) for wave_picks
ALTER TABLE public.wave_picks ENABLE ROW LEVEL SECURITY;
-- Add RLS Policies for wave_picks
CREATE POLICY "Enable read access for all users on wave_picks" ON public.wave_picks FOR
SELECT USING (true);
CREATE POLICY "Enable insert access for all users on wave_picks" ON public.wave_picks FOR
INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users on wave_picks" ON public.wave_picks FOR
UPDATE USING (true);
-- 2. Add wave_id foreign key to pick_lists table
ALTER TABLE public.pick_lists
ADD COLUMN IF NOT EXISTS wave_id UUID REFERENCES public.wave_picks(id) ON DELETE
SET NULL;
-- 3. Useful query for testing (Optional)
-- UPDATE pick_lists set status = 'OPEN' where status = 'PICKED';