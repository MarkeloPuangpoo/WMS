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