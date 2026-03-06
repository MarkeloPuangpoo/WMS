-- ==========================================
-- Phase 8: RBAC Expansion & Stock Adjustment Approval
-- ==========================================
-- A. Expand app_role enum with picker and packer
ALTER TYPE public.app_role
ADD VALUE IF NOT EXISTS 'picker';
ALTER TYPE public.app_role
ADD VALUE IF NOT EXISTS 'packer';
-- B. Create adjustment_request_status enum
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'adjustment_request_status'
) THEN CREATE TYPE public.adjustment_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
END IF;
END $$;
-- C. Create adjustment_requests table
CREATE TABLE IF NOT EXISTS public.adjustment_requests (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.products(id) not null,
    location_id uuid references public.locations(id) not null,
    quantity_change integer not null,
    -- positive = add, negative = deduct
    reason text not null,
    status public.adjustment_request_status default 'PENDING'::public.adjustment_request_status not null,
    requested_by uuid references public.user_profiles(id) not null,
    reviewed_by uuid references public.user_profiles(id),
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- D. RLS for adjustment_requests
ALTER TABLE public.adjustment_requests ENABLE ROW LEVEL SECURITY;
-- Everyone can read adjustment requests
CREATE POLICY "Allow authenticated read adjustment_requests" ON public.adjustment_requests FOR
SELECT TO authenticated USING (true);
-- Any authenticated user can create a request
CREATE POLICY "Allow authenticated insert adjustment_requests" ON public.adjustment_requests FOR
INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);
-- Only superadmin/sup can update (approve/reject)
CREATE POLICY "Allow managers to update adjustment_requests" ON public.adjustment_requests FOR
UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
                AND user_profiles.role IN ('superadmin', 'sup')
        )
    );
-- E. Update inventory_transactions INSERT policy to allow picker role
-- Drop old restrictive policy and replace with expanded one
DROP POLICY IF EXISTS "Allow supervisors and admins to insert" ON public.inventory_transactions;
CREATE POLICY "Allow authorized roles to insert transactions" ON public.inventory_transactions FOR
INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
                AND user_profiles.role::text IN ('superadmin', 'sup', 'picker', 'packer')
        )
    );
-- F. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_adjustment_requests_status ON public.adjustment_requests(status);
CREATE INDEX IF NOT EXISTS idx_adjustment_requests_requested_by ON public.adjustment_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_adjustment_requests_product ON public.adjustment_requests(product_id);