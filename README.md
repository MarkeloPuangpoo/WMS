# Colamarc WMS (Warehouse Management System)

A modern, high-performance web application for warehouse management, built with **Next.js 16**, **Tailwind CSS v4**, and **Supabase**. The project features a premium White & Blue UI aesthetic with clean layouts tailored for efficient operational data entry.

---

## 🚀 Features & Capabilities

The WMS has been built through multiple phases to support advanced warehouse operations:

### 1. Dashboard & Real-Time Metrics
- Live summary of Total Products, critical Low Stock alerts, and Total Quantity in the warehouse.
- Recent activity feed showing inbound and outbound operations at a glance.

### 2. Master Data Management
- **Products**: Full CRUD with SKU tracking, categorization, and Minimum Stock Levels.
- **Locations**: Management of Zones, Aisles, Racks, Levels, and Bin Codes (e.g., `A-01-01`).
- Direct integration with Supabase for real-time reads and writes.

### 3. Advanced Inventory Tracking (Lots & Expiry)
- **Lot Management**: Track items by `mfg_date`, `exp_date`, and `lot_number`.
- **FEFO Picking** (First Expire, First Out): Smart picking system that recommends staff to pick from the oldest/closest-to-expiry lots first.
- **Lot Dashboard**: Dedicated `/inventory/lots` UI with color-coded badges for *OK*, *Expiring Soon (≤30 Days)*, and *Expired* items.

### 4. Smart Mobile Picking Flow
- **Barcode & QR Scanning**: Integrated `react-qr-reader` / `html5-qrcode` to allow warehouse staff to use mobile devices or tablets to scan Bin Location QR codes and Product Barcodes.
- Step-by-step verification ensures 100% picking accuracy.

### 5. Multi-Tier Role-Based Access Control (RBAC)
Robust security system utilizing Supabase Row Level Security (RLS) restricting operations based on 4 distinct app roles:
- **`superadmin` / `sup`**: Full visibility. Can assign pick lists, run transactions, and approve stock adjustments.
- **`picker`**: Focused "My Tasks" view to execute assigned open pick lists via barcode flow. View-only access to Lot Inventory.
- **`packer`**: Focused "My Tasks" view showing only orders ready to be packed and shipped.

### 6. Stock Adjustment Approval Workflow
- Direct adjustment (shrinking) of stock requires an approval flow.
- Staff submit a **Pending Request** (specifying location, quantity change, and reason).
- Managers receive an alert, review the request, and can **Approve** (commits the `ADJUSTMENT` to `inventory_transactions`) or **Reject**.

### 7. Wave & Batch Picking (Phase 11)
- **Batch Picks:** Managers can aggregate multiple orders containing similar SKUs into a single "Wave".
- **Route Optimization:** Product locations are queried and automatically sorted alphanumericly (A-01 before B-02) so the picker walks a continuous, non-overlapping path.
- **Put-to-Wall Sorting:** Packers get a visual dashboard telling them exactly which order bin to drop a scanned item into.

### 8. In-house Fleet Management Mini-TMS (Phase 12)
- **Fleet Dispatching:** A Dispatcher UI mapping `PACKED` orders to company `vehicles` and `drivers` into active `delivery_trips`.
- **Internal Waybills:** Automatically generates a fully formatted A6 shipping label specifically structured for thermal label printers, including a dynamic tracking/QR Code.
- **Progressive Web App (PWA) for Drivers:** A mobile-first UI for drivers to view route manifests and scan waybills with their camera to submit Proof of Delivery (POD).

### 9. Beautiful UI / UX
- Custom animated **Toast Notification System** replacing all browser `alert()` calls.
- `lucide-react` iconography used consistently across the application.
- Intelligent `Sidebar` navigation that dynamically re-renders based on the authenticated user's role.

---

## 🛠 Getting Started

### 1. Prerequisites
- Node.js 18+
- Active Supabase Project

### 2. Setup
1. Clone the repository and run `npm install`.
2. Set up your local `.env.local` by copying `.env.example` and providing your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. In your Supabase Dashboard SQL Editor, run the master schema script:
   - `supabase/master_schema_full.sql` (Creates all tables from Phase 1-12, seeds mock data, sets up RBAC, and inserts Demo Accounts)
4. Start the application: `npm run dev`

### 3. Demo Accounts 🔑
The `phase8_seed_users.sql` script provides 4 testing accounts.
**All passwords are:** `password123`

| Role        | Email                  | Capabilities                    |
| ----------- | ---------------------- | ------------------------------- |
| **Admin**   | `admin@colamarc.com`   | Full System Access              |
| **Manager** | `manager@colamarc.com` | Reports, Approvals, Assignments |
| **Picker**  | `picker@colamarc.com`  | Mobile Picking Flow, My Tasks   |
| **Packer**  | `packer@colamarc.com`  | Shipping Flow, My Tasks         |

---

## 📚 Technical Stack
- **Framework:** Next.js 16 (App Router, Server Actions)
- **Styling:** Tailwind CSS v4, Lucide React
- **Backend/DB:** Supabase (PostgreSQL, Row Level Security, Auth)
- **Scanning:** `html5-qrcode` & `react-qr-reader`
