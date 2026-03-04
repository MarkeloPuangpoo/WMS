-- ==========================================
-- 1. Create App Role Enum
-- ==========================================
CREATE TYPE public.app_role AS ENUM ('superadmin', 'sup', 'user');
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
CREATE TYPE public.transaction_type AS ENUM ('INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT');
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
        sku,
        name,
        description,
        quantity,
        min_stock_level,
        location_id
    )
VALUES (
        'SKU-001',
        'Wireless Mouse',
        'Ergonomic wireless mouse',
        150,
        20,
        '11111111-1111-1111-1111-111111111111'
    ),
    (
        'SKU-002',
        'Mechanical Keyboard',
        'Blue switches',
        5,
        10,
        '22222222-2222-2222-2222-222222222222'
    ),
    (
        'SKU-003',
        'USB-C Hub',
        '7-in-1 adapter',
        45,
        15,
        '11111111-1111-1111-1111-111111111111'
    ),
    (
        'SKU-004',
        'Laptop Stand',
        'Aluminum adjustable stand',
        8,
        10,
        '33333333-3333-3333-3333-333333333333'
    );
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
    );
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
    );
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
    );
-- 4. Update the generated user_profiles to match their explicit roles
UPDATE public.user_profiles
SET role = 'superadmin'
WHERE id = 'aaaa1111-1111-1111-1111-111111111111';
UPDATE public.user_profiles
SET role = 'sup'
WHERE id = 'bbbb2222-2222-2222-2222-222222222222';
-- The 'user' account defaults to 'user' from the trigger, so no update needed!