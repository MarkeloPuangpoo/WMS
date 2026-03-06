-- ==========================================
-- Phase 9: API Integration & Webhooks
-- ==========================================
-- A. Create api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    -- E.g. "Shopee Store 1", "Shopify Main"
    key_hash text not null unique,
    -- Hashed API key (never store raw keys)
    prefix text not null,
    -- To help user identify the key e.g. "shpee_..."
    status text default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED')),
    created_by uuid references public.user_profiles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_used_at timestamp with time zone
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- Only superadmin can manage API keys
CREATE POLICY "Allow superadmin full access to api_keys" ON public.api_keys FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'superadmin'
    )
);
-- B. Create webhook_endpoints table (For Outbound Sync)
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    -- E.g. "Shopee Update Webhook"
    url text not null,
    event_type text not null,
    -- E.g. "ORDER_SHIPPED", "STOCK_ADJUSTED"
    secret text,
    -- Optional secret for signing the webhook payload
    is_active boolean default true not null,
    created_by uuid references public.user_profiles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow superadmin full access to webhook_endpoints" ON public.webhook_endpoints FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'superadmin'
    )
);
-- C. Create outbound_webhook_logs table (For tracking successes/failures)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id uuid default gen_random_uuid() primary key,
    webhook_id uuid references public.webhook_endpoints(id) on delete
    set null,
        event_type text not null,
        payload jsonb not null,
        response_status integer,
        response_body text,
        is_success boolean not null,
        execution_time_ms integer,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access to webhook_logs for managers and admins" ON public.webhook_logs FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('superadmin', 'sup')
    )
);
-- D. Update picking list items to support external source reference (Optional but helpful for debug)
ALTER TABLE public.sales_orders
ADD COLUMN IF NOT EXISTS external_source text;
-- e.g. "Shopee"
ALTER TABLE public.sales_orders
ADD COLUMN IF NOT EXISTS external_order_id text;
-- e.g. "230306XXXXX"