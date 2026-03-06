

-- ===========================================
-- FILE: supabase/setup.sql
-- ===========================================

-- ==========================================
-- 1. Create App Role Enum
-- ==========================================
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'app_role'
) THEN CREATE TYPE public.app_role AS ENUM ('superadmin', 'sup', 'user');
END IF;
END $$;
-- ==========================================
-- 2. Create User Profiles Table
-- ==========================================
CREATE TABLE public.user_profiles (
    id uuid references auth.users not null primary key,
    role public.app_role default 'user'::public.app_role not null,
    full_name text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Turn on RLS for Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.user_profiles FOR
SELECT USING (true);
CREATE POLICY "Allow individual update" ON public.user_profiles FOR
UPDATE USING (auth.uid() = id);
-- ==========================================
-- 3. Automatic Profile Creation Trigger
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$ BEGIN
INSERT INTO public.user_profiles (id, full_name, role)
VALUES (
        new.id,
        new.raw_user_meta_data->>'full_name',
        'user'
    );
RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- ==========================================
-- 4. Create Locations Master Table
-- ==========================================
CREATE TABLE public.locations (
    id uuid default gen_random_uuid() primary key,
    zone_name text not null,
    bin_code text not null unique,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- ==========================================
-- 5. Create Products Master Table
-- ==========================================
CREATE TABLE public.products (
    id uuid default gen_random_uuid() primary key,
    sku text not null unique,
    name text not null,
    description text,
    quantity integer default 0 not null,
    min_stock_level integer default 10 not null,
    location_id uuid references public.locations(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- ==========================================
-- 6. Create Transaction Type Enum
-- ==========================================
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'transaction_type'
) THEN CREATE TYPE public.transaction_type AS ENUM ('INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT');
END IF;
END $$;
-- ==========================================
-- 7. Create Inventory Transactions Table
-- ==========================================
CREATE TABLE public.inventory_transactions (
    id uuid default gen_random_uuid() primary key,
    transaction_type public.transaction_type not null,
    product_id uuid references public.products(id) not null,
    location_id uuid references public.locations(id) not null,
    quantity integer not null,
    reference_doc text,
    notes text,
    created_by uuid references public.user_profiles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Turn on RLS for Security
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read access" ON public.inventory_transactions FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Allow supervisors and admins to insert" ON public.inventory_transactions FOR
INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
                AND user_profiles.role IN ('superadmin', 'sup')
        )
    );
-- Performance Indexes
CREATE INDEX idx_inventory_transactions_product_id ON public.inventory_transactions(product_id);
CREATE INDEX idx_inventory_transactions_created_at ON public.inventory_transactions(created_at DESC);
CREATE INDEX idx_inventory_transactions_type ON public.inventory_transactions(transaction_type);
-- ==========================================
-- 8. Trigger: Auto-update Product Quantity
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_product_quantity() RETURNS trigger AS $$ BEGIN
UPDATE public.products
SET quantity = quantity + NEW.quantity
WHERE id = NEW.product_id;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_inventory_transaction_created
AFTER
INSERT ON public.inventory_transactions FOR EACH ROW EXECUTE PROCEDURE public.update_product_quantity();
-- ==========================================
-- 9. Phase 5: Outbound Process (Sales & Pick Lists)
-- ==========================================
-- A. Order Status Enum
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'order_status'
) THEN CREATE TYPE public.order_status AS ENUM (
    'PENDING',
    'PICKING',
    'PACKED',
    'SHIPPED',
    'CANCELLED'
);
END IF;
END $$;
-- B. Sales Orders Table
CREATE TABLE public.sales_orders (
    id uuid default gen_random_uuid() primary key,
    order_number text not null unique,
    customer_name text not null,
    status public.order_status default 'PENDING'::public.order_status not null,
    total_items integer default 0 not null,
    notes text,
    created_by uuid references public.user_profiles(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Turn on RLS for Security
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to sales_orders" ON public.sales_orders FOR ALL TO authenticated USING (true);
-- C. Sales Order Items Table
CREATE TABLE public.sales_order_items (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.sales_orders(id) on delete cascade not null,
    product_id uuid references public.products(id) not null,
    quantity integer not null check (quantity > 0),
    picked_quantity integer default 0 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Turn on RLS for Security
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to sales_order_items" ON public.sales_order_items FOR ALL TO authenticated USING (true);
-- D. Pick List Status Enum
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'pick_list_status'
) THEN CREATE TYPE public.pick_list_status AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');
END IF;
END $$;
-- E. Pick Lists Table
CREATE TABLE public.pick_lists (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.sales_orders(id) on delete cascade not null unique,
    assigned_to uuid references public.user_profiles(id),
    status public.pick_list_status default 'OPEN'::public.pick_list_status not null,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Turn on RLS for Security
ALTER TABLE public.pick_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to pick_lists" ON public.pick_lists FOR ALL TO authenticated USING (true);
-- Indexes for fast queries
CREATE INDEX idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX idx_sales_order_items_order_id ON public.sales_order_items(order_id);
CREATE INDEX idx_pick_lists_order_id ON public.pick_lists(order_id);
CREATE INDEX idx_pick_lists_assigned_to ON public.pick_lists(assigned_to);
-- Function to Auto-Update `updated_at`
CREATE OR REPLACE FUNCTION update_modified_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now();
RETURN NEW;
END;
$$ language 'plpgsql';
CREATE TRIGGER update_sales_orders_modtime BEFORE
UPDATE ON public.sales_orders FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
-- ==========================================
-- ==========================================
-- SEED DATA BELOW
-- ==========================================
-- ==========================================
-- 1. Seed Locations
INSERT INTO public.locations (id, zone_name, bin_code, description)
VALUES (
        '11111111-1111-1111-1111-111111111111',
        'Zone A',
        'A-01-01',
        'Fast moving goods'
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'Zone A',
        'A-01-02',
        'Fast moving goods'
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'Zone B',
        'B-01-01',
        'Heavy items'
    );
-- 2. Seed Products
INSERT INTO public.products (
        id,
        sku,
        name,
        description,
        quantity,
        min_stock_level,
        location_id
    )
VALUES (
        '44444444-4444-4444-4444-444444444444',
        'SKU-001',
        'Wireless Mouse',
        'Ergonomic wireless mouse',
        150,
        20,
        '11111111-1111-1111-1111-111111111111'
    ),
    (
        '55555555-5555-5555-5555-555555555555',
        'SKU-002',
        'Mechanical Keyboard',
        'Blue switches',
        5,
        10,
        '22222222-2222-2222-2222-222222222222'
    ),
    (
        '66666666-6666-6666-6666-666666666666',
        'SKU-003',
        'USB-C Hub',
        '7-in-1 adapter',
        45,
        15,
        '11111111-1111-1111-1111-111111111111'
    ),
    (
        '77777777-7777-7777-7777-777777777777',
        'SKU-004',
        'Laptop Stand',
        'Aluminum adjustable stand',
        8,
        10,
        '33333333-3333-3333-3333-333333333333'
    ) ON CONFLICT (sku) DO NOTHING;
-- 3. Seed Auth Users (Default password: password123)
-- SUPERADMIN (admin@colamarc.com)
INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    )
VALUES (
        'aaaa1111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'admin@colamarc.com',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name": "Super Admin"}',
        now(),
        now(),
        '',
        '',
        '',
        ''
    ) ON CONFLICT (id) DO NOTHING;
-- SUPERVISOR (sup@colamarc.com)
INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    )
VALUES (
        'bbbb2222-2222-2222-2222-222222222222',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'sup@colamarc.com',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name": "Supervisor"}',
        now(),
        now(),
        '',
        '',
        '',
        ''
    ) ON CONFLICT (id) DO NOTHING;
-- WORKER USER (user@colamarc.com)
INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    )
VALUES (
        'cccc3333-3333-3333-3333-333333333333',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'user@colamarc.com',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name": "Worker"}',
        now(),
        now(),
        '',
        '',
        '',
        ''
    ) ON CONFLICT (id) DO NOTHING;
-- 4. Update the generated user_profiles to match their explicit roles
UPDATE public.user_profiles
SET role = 'superadmin'
WHERE id = 'aaaa1111-1111-1111-1111-111111111111';
UPDATE public.user_profiles
SET role = 'sup'
WHERE id = 'bbbb2222-2222-2222-2222-222222222222';
-- ==========================================
-- 5. Seed Phase 5 Outbound Data (Testing)
-- ==========================================
INSERT INTO public.sales_orders (
        id,
        order_number,
        customer_name,
        status,
        total_items
    )
VALUES (
        '88888888-8888-8888-8888-888888888881',
        'SO-2026-001',
        'Acme Corp',
        'PENDING',
        2
    ),
    (
        '88888888-8888-8888-8888-888888888882',
        'SO-2026-002',
        'TechFlow Inc.',
        'PENDING',
        1
    ) ON CONFLICT (order_number) DO NOTHING;
-- Order 1: 5x Wireless Mouse, 2x Laptop Stand
INSERT INTO public.sales_order_items (order_id, product_id, quantity)
VALUES (
        '88888888-8888-8888-8888-888888888881',
        '44444444-4444-4444-4444-444444444444',
        5
    ),
    -- Mouse
    (
        '88888888-8888-8888-8888-888888888881',
        '77777777-7777-7777-7777-777777777777',
        2
    );
-- Laptop Stand
-- Order 2: 1x Mechanical Keyboard
INSERT INTO public.sales_order_items (order_id, product_id, quantity)
VALUES (
        '88888888-8888-8888-8888-888888888882',
        '55555555-5555-5555-5555-555555555555',
        1
    );
-- Keyboard
-- Generate Pick Lists for Pending Orders
INSERT INTO public.pick_lists (order_id)
VALUES ('88888888-8888-8888-8888-888888888881'),
    ('88888888-8888-8888-8888-888888888882') ON CONFLICT (order_id) DO NOTHING;

-- ===========================================
-- FILE: supabase/phase5_outbound.sql
-- ===========================================

-- ==========================================
-- Phase 5: Outbound Process (Sales & Pick Lists)
-- ==========================================
-- A. Order Status Enum
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'order_status'
) THEN CREATE TYPE public.order_status AS ENUM (
    'PENDING',
    'PICKING',
    'PACKED',
    'SHIPPED',
    'CANCELLED'
);
END IF;
END $$;
-- B. Sales Orders Table
CREATE TABLE IF NOT EXISTS public.sales_orders (
    id uuid default gen_random_uuid() primary key,
    order_number text not null unique,
    customer_name text not null,
    status public.order_status default 'PENDING'::public.order_status not null,
    total_items integer default 0 not null,
    notes text,
    created_by uuid references public.user_profiles(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Turn on RLS for Security
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to sales_orders" ON public.sales_orders;
CREATE POLICY "Allow authenticated full access to sales_orders" ON public.sales_orders FOR ALL TO authenticated USING (true);
-- C. Sales Order Items Table
CREATE TABLE IF NOT EXISTS public.sales_order_items (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.sales_orders(id) on delete cascade not null,
    product_id uuid references public.products(id) not null,
    quantity integer not null check (quantity > 0),
    picked_quantity integer default 0 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Turn on RLS for Security
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to sales_order_items" ON public.sales_order_items;
CREATE POLICY "Allow authenticated full access to sales_order_items" ON public.sales_order_items FOR ALL TO authenticated USING (true);
-- D. Pick List Status Enum
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'pick_list_status'
) THEN CREATE TYPE public.pick_list_status AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');
END IF;
END $$;
-- E. Pick Lists Table
CREATE TABLE IF NOT EXISTS public.pick_lists (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.sales_orders(id) on delete cascade not null unique,
    assigned_to uuid references public.user_profiles(id),
    status public.pick_list_status default 'OPEN'::public.pick_list_status not null,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Turn on RLS for Security
ALTER TABLE public.pick_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to pick_lists" ON public.pick_lists;
CREATE POLICY "Allow authenticated full access to pick_lists" ON public.pick_lists FOR ALL TO authenticated USING (true);
-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order_id ON public.sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_pick_lists_order_id ON public.pick_lists(order_id);
CREATE INDEX IF NOT EXISTS idx_pick_lists_assigned_to ON public.pick_lists(assigned_to);
-- Function to Auto-Update `updated_at`
CREATE OR REPLACE FUNCTION update_modified_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now();
RETURN NEW;
END;
$$ language 'plpgsql';
DROP TRIGGER IF EXISTS update_sales_orders_modtime ON public.sales_orders;
CREATE TRIGGER update_sales_orders_modtime BEFORE
UPDATE ON public.sales_orders FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
-- ==========================================
-- Seed Phase 5 Outbound Data (Testing)
-- ==========================================
INSERT INTO public.sales_orders (
        id,
        order_number,
        customer_name,
        status,
        total_items
    )
VALUES (
        '88888888-8888-8888-8888-888888888881',
        'SO-2026-001',
        'Acme Corp',
        'PENDING',
        2
    ),
    (
        '88888888-8888-8888-8888-888888888882',
        'SO-2026-002',
        'TechFlow Inc.',
        'PENDING',
        1
    ) ON CONFLICT (order_number) DO NOTHING;
-- Order 1: 5x Wireless Mouse (SKU-001), 2x Laptop Stand (SKU-004)
INSERT INTO public.sales_order_items (order_id, product_id, quantity)
SELECT '88888888-8888-8888-8888-888888888881',
    id,
    5
FROM public.products
WHERE sku = 'SKU-001' ON CONFLICT DO NOTHING;
INSERT INTO public.sales_order_items (order_id, product_id, quantity)
SELECT '88888888-8888-8888-8888-888888888881',
    id,
    2
FROM public.products
WHERE sku = 'SKU-004' ON CONFLICT DO NOTHING;
-- Order 2: 1x Mechanical Keyboard (SKU-002)
INSERT INTO public.sales_order_items (order_id, product_id, quantity)
SELECT '88888888-8888-8888-8888-888888888882',
    id,
    1
FROM public.products
WHERE sku = 'SKU-002' ON CONFLICT DO NOTHING;
-- Generate Pick Lists for Pending Orders
INSERT INTO public.pick_lists (order_id)
VALUES ('88888888-8888-8888-8888-888888888881'),
    ('88888888-8888-8888-8888-888888888882') ON CONFLICT (order_id) DO NOTHING;

-- ===========================================
-- FILE: supabase/phase7_lots.sql
-- ===========================================

-- ==========================================
-- Phase 7: Lot/Batch & Expiry Date Management
-- ==========================================
-- A. Inventory Lots Table
-- Tracks stock at lot level: each row = a specific lot of a product at a specific location
CREATE TABLE IF NOT EXISTS public.inventory_lots (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.products(id) not null,
    location_id uuid references public.locations(id) not null,
    lot_number text not null,
    mfg_date date,
    exp_date date,
    quantity integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Unique constraint: one row per product+location+lot combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_lots_unique ON public.inventory_lots(product_id, location_id, lot_number);
-- Fast FEFO lookups: find nearest expiry first
CREATE INDEX IF NOT EXISTS idx_inventory_lots_fefo ON public.inventory_lots(product_id, exp_date ASC);
-- RLS
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to inventory_lots" ON public.inventory_lots FOR ALL TO authenticated USING (true);
-- B. Add lot_number column to inventory_transactions for traceability
ALTER TABLE public.inventory_transactions
ADD COLUMN IF NOT EXISTS lot_number text;
-- C. Seed some lot data for testing (uses SKU/bin_code lookup instead of hardcoded UUIDs)
INSERT INTO public.inventory_lots (
        product_id,
        location_id,
        lot_number,
        mfg_date,
        exp_date,
        quantity
    )
SELECT p.id,
    l.id,
    v.lot_number,
    v.mfg_date::date,
    v.exp_date::date,
    v.quantity
FROM (
        VALUES (
                'SKU-001',
                'A-01-01',
                'LOT-WM-2025-A',
                '2025-06-01',
                '2026-06-01',
                80
            ),
            (
                'SKU-001',
                'A-01-01',
                'LOT-WM-2026-B',
                '2026-01-15',
                '2027-01-15',
                70
            ),
            (
                'SKU-002',
                'A-01-02',
                'LOT-KB-2025-A',
                '2025-09-01',
                '2026-04-10',
                5
            ),
            (
                'SKU-003',
                'A-01-01',
                'LOT-HUB-2025-A',
                '2025-03-01',
                '2026-03-15',
                20
            ),
            (
                'SKU-003',
                'A-01-01',
                'LOT-HUB-2026-B',
                '2026-02-01',
                '2027-02-01',
                25
            ),
            (
                'SKU-004',
                'B-01-01',
                'LOT-LS-2025-A',
                '2025-11-01',
                '2026-05-01',
                8
            )
    ) AS v(
        sku,
        bin_code,
        lot_number,
        mfg_date,
        exp_date,
        quantity
    )
    JOIN public.products p ON p.sku = v.sku
    JOIN public.locations l ON l.bin_code = v.bin_code ON CONFLICT DO NOTHING;

-- ===========================================
-- FILE: supabase/phase8_rbac.sql
-- ===========================================

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

-- ===========================================
-- FILE: supabase/phase8_seed_users.sql
-- ===========================================

-- ==========================================
-- Seeds Mock Accounts for Testing RBAC
-- Password for all accounts: password123
-- ==========================================
DO $$
DECLARE superadmin_id uuid := gen_random_uuid();
sup_id uuid := gen_random_uuid();
picker_id uuid := gen_random_uuid();
packer_id uuid := gen_random_uuid();
BEGIN -- 1. Insert into auth.users (creates the user accounts)
-- We only insert if the email does not already exist
IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = 'admin@colamarc.com'
) THEN
INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
VALUES (
        superadmin_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'admin@colamarc.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );
INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
VALUES (
        superadmin_id,
        superadmin_id,
        format(
            '{"sub":"%s","email":"%s"}',
            superadmin_id::text,
            'admin@colamarc.com'
        )::jsonb,
        'email',
        'admin@colamarc.com',
        now(),
        now(),
        now()
    );
ELSE
SELECT id INTO superadmin_id
FROM auth.users
WHERE email = 'admin@colamarc.com';
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = 'manager@colamarc.com'
) THEN
INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
VALUES (
        sup_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'manager@colamarc.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );
INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
VALUES (
        sup_id,
        sup_id,
        format(
            '{"sub":"%s","email":"%s"}',
            sup_id::text,
            'manager@colamarc.com'
        )::jsonb,
        'email',
        'manager@colamarc.com',
        now(),
        now(),
        now()
    );
ELSE
SELECT id INTO sup_id
FROM auth.users
WHERE email = 'manager@colamarc.com';
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = 'picker@colamarc.com'
) THEN
INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
VALUES (
        picker_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'picker@colamarc.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );
INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
VALUES (
        picker_id,
        picker_id,
        format(
            '{"sub":"%s","email":"%s"}',
            picker_id::text,
            'picker@colamarc.com'
        )::jsonb,
        'email',
        'picker@colamarc.com',
        now(),
        now(),
        now()
    );
ELSE
SELECT id INTO picker_id
FROM auth.users
WHERE email = 'picker@colamarc.com';
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = 'packer@colamarc.com'
) THEN
INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
VALUES (
        packer_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'packer@colamarc.com',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );
INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
VALUES (
        packer_id,
        packer_id,
        format(
            '{"sub":"%s","email":"%s"}',
            packer_id::text,
            'packer@colamarc.com'
        )::jsonb,
        'email',
        'packer@colamarc.com',
        now(),
        now(),
        now()
    );
ELSE
SELECT id INTO packer_id
FROM auth.users
WHERE email = 'packer@colamarc.com';
END IF;
-- 2. Update public.user_profiles safely using ON CONFLICT since it's a primary key
INSERT INTO public.user_profiles (id, full_name, role)
VALUES (
        superadmin_id,
        'Super Admin',
        'superadmin'::public.app_role
    ),
    (
        sup_id,
        'Warehouse Manager',
        'sup'::public.app_role
    ),
    (
        picker_id,
        'John Picker',
        'picker'::public.app_role
    ),
    (
        packer_id,
        'Jane Packer',
        'packer'::public.app_role
    ) ON CONFLICT (id) DO
UPDATE
SET full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
END $$;

-- ===========================================
-- FILE: supabase/phase9_api.sql
-- ===========================================

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

-- ===========================================
-- FILE: scripts/phase11_db_migration.sql
-- ===========================================

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

-- ===========================================
-- FILE: scripts/phase12_db_migration.sql
-- ===========================================

-- Phase 12: In-house Fleet Management (Mini-TMS) Migration
-- 1. Create Vehicles Table
CREATE TABLE public.vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_plate TEXT NOT NULL,
    type TEXT NOT NULL,
    -- e.g., 'Van', 'Truck', 'Motorcycle'
    capacity TEXT,
    -- e.g., '1000kg', '200 Boxes'
    status TEXT DEFAULT 'ACTIVE',
    -- ACTIVE, MAINTENANCE, INACTIVE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 2. Create Drivers Table
-- Note: 'user_id' can be linked to auth.users if drivers log into the system
CREATE TABLE public.drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    -- ACTIVE, ON_LEAVE, INACTIVE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 3. Create Delivery Trips Table (Manifests)
CREATE TABLE public.delivery_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_number TEXT NOT NULL UNIQUE,
    -- e.g., TRP-2603-001
    vehicle_id UUID REFERENCES public.vehicles(id),
    driver_id UUID REFERENCES public.drivers(id),
    status TEXT DEFAULT 'DRAFT',
    -- DRAFT, ASSIGNED, IN_TRANSIT, COMPLETED, CANCELLED
    scheduled_date DATE NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);
-- 4. Add 'trip_id' to Sales Orders
ALTER TABLE public.sales_orders
ADD COLUMN trip_id UUID REFERENCES public.delivery_trips(id);
-- Optional: Add 'tracking_mapping' if we want to store internal tracking numbers like CLM-260307-001 directly on the order
ALTER TABLE public.sales_orders
ADD COLUMN internal_tracking_number TEXT;
-- 5. RLS Policies (Optional but recommended for production)
-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_trips ENABLE ROW LEVEL SECURITY;
-- Allow authenticated users to view
CREATE POLICY "Allow authenticated read access on vehicles" ON public.vehicles FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access on drivers" ON public.drivers FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access on delivery_trips" ON public.delivery_trips FOR
SELECT TO authenticated USING (true);
-- Allow superadmin/sup to insert/update. Drivers can only view (and update specific states in application logic mapped to service roles)
CREATE POLICY "Allow management mutation on vehicles" ON public.vehicles FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('superadmin', 'sup')
    )
);
CREATE POLICY "Allow management mutation on drivers" ON public.drivers FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('superadmin', 'sup')
    )
);
CREATE POLICY "Allow management mutation on delivery_trips" ON public.delivery_trips FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('superadmin', 'sup')
    )
);