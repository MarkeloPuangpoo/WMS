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