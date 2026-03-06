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