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