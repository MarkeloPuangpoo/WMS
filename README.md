# colamarc WMS (Warehouse Management System)

A modern, high-performance web application for warehouse management, built with Next.js 16, Tailwind CSS v4, and Supabase. The project features a premium White & Blue UI aesthetic with clean layouts tailored for efficient data entry.

## 🚀 Phase 1: Master Data & RBAC (Currently in Progress)

### ✅ What's Done So Far
1. **Core Layout & UI Foundation**
   - Configured Next.js 16 App Router with Turbopack.
   - Set up Tailwind CSS v4 with a custom White & Blue styling (`globals.css`).
   - Implemented dynamic Sidebar and Header navigation components using `lucide-react` icons.

2. **Supabase Integration & RBAC Structure**
   - Integrated `@supabase/ssr` to handle Next.js App Router authentication.
   - Created database roles: `superadmin`, `sup`, and `user`.
   - Setup `middleware` (`proxy.ts`) for Route Protection so unauthenticated users are forced to Login.
   - Developed the **Login Page** UI using Server Actions to authenticate credentials against Supabase.
   - Built the SQL file (`supabase/setup.sql`) to provision the DB schema, RLS policies, User Roles Trigger, and mocked seed data.
   - Modified the layout to fetch the current user's profile and display their `full_name` and `email` dynamically in the Header. Includes a working **Sign Out** button.

3. **Master Data Skeleton UI**
   - Built the `/inventory/products` Data Table with basic Search and a "Low Stock" toggle filter.
   - Built the `/inventory/locations` Data Table layout.

### 🚧 What's Next (To-Do List)

1. **Master Data CRUD Operations**
   - Connect the Products and Locations data tables directly to the Supabase Database to read real data instead of React State mocks.
   - Build **Modals / Forms** for Add, Edit, and Delete actions for both Locations and Products.
   - Add notification/toast system on successful saves.

2. **Dashboard Real-time Metrics**
   - Update the `<Dashboard />` (`src/app/(dashboard)/page.tsx`) to query and summarize metrics directly from Supabase.
   - E.g., Calculate "Total Quantity of all items" or "Count of SKUs under min_stock_level".
   - (Optional Extra) Setup Supabase Real-time to push live updates when stock changes.

3. **RBAC UI Enhancements**
   - Implement authorization checks within components (e.g., Hide the "Settings" sidebar item or "Delete" buttons if the current user is not a `superadmin`).

## 🛠 Getting Started

1. Set up your local `.env.local` referring to `.env.example`.
2. Ensure you have run the schema in `supabase/setup.sql` on your Supabase dashboard.
3. Install dependencies: `npm install`
4. Run the development server: `npm run dev`
5. Visit `http://localhost:3000` and login using one of the Seed Accounts below:

### 🔑 Seed Users (3 Roles)
The database has been pre-seeded with 3 user roles for testing purposes. 
**All accounts use the same password:** `password123`

- **Super Admin:** `admin@colamarc.com`
- **Supervisor:** `sup@colamarc.com`
- **Worker (User):** `user@colamarc.com`
