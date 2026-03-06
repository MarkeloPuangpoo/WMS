import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyApiKey } from '@/lib/api-auth';

// Define expected payload structure
type OrderItemPayload = {
    sku: string;
    quantity: number;
    product_name?: string;
};

type OrderPayload = {
    ecommerce_reference_id?: string; // Shopee-style format
    order_number?: string;           // Fallback format
    source_platform?: string;        // "Shopee"
    external_source?: string;        // Fallback
    customer?: {
        name: string;
        phone?: string;
        address?: string;
    };
    customer_name?: string;          // Fallback
    items: OrderItemPayload[];
};

export async function POST(request: Request) {
    try {
        // 1. Authenticate Request
        const authResult = await verifyApiKey();
        if (!authResult.isValid) {
            return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
        }

        // 2. Parse Payload
        const payload: OrderPayload = await request.json();

        // 2.1 Normalize the Payload (Support both our internal mock and the new realistic structure)
        const orderNumber = payload.ecommerce_reference_id || payload.order_number;
        const customerName = payload.customer?.name || payload.customer_name;
        const externalSource = payload.source_platform || payload.external_source || 'API Webhook';

        if (!orderNumber || !customerName || !payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
            return NextResponse.json({
                success: false,
                error: "Invalid payload format. Expected 'ecommerce_reference_id' (or 'order_number'), 'customer.name', and a valid 'items' array."
            }, { status: 400 });
        }

        // Initialize Supabase Admin strictly for Server-side background jobs
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 3. Data Mapping: Find product UUIDs using incoming SKUs
        const skus = payload.items.map(item => item.sku);

        const { data: products, error: productError } = await supabaseAdmin
            .from('products')
            .select('id, sku')
            .in('sku', skus);

        if (productError) {
            console.error("Error fetching products:", productError);
            return NextResponse.json({ success: false, error: "Database error while resolving product SKUs" }, { status: 500 });
        }

        // Verify all SKUs were found
        const foundSkus = products?.map(p => p.sku) || [];
        const missingSkus = skus.filter(sku => !foundSkus.includes(sku));

        if (missingSkus.length > 0) {
            return NextResponse.json({
                success: false,
                error: `Unknown SKUs found in payload. Cannot process order.`,
                missing_skus: missingSkus
            }, { status: 400 });
        }

        // 4. Create Sales Order
        const totalItems = payload.items.reduce((sum, item) => sum + item.quantity, 0);

        const { data: order, error: orderError } = await supabaseAdmin
            .from('sales_orders')
            .insert({
                order_number: orderNumber,
                customer_name: customerName,
                total_items: totalItems,
                status: 'PENDING',
                external_source: externalSource,
                external_order_id: orderNumber
            })
            .select('id')
            .single();

        if (orderError) throw orderError;
        const orderId = order.id;

        // 5. Create Sales Order Items
        const orderItemsToInsert = payload.items.map(payloadItem => {
            const product = products!.find(p => p.sku === payloadItem.sku);
            return {
                order_id: orderId,
                product_id: product!.id,
                quantity: payloadItem.quantity
            };
        });

        const { error: itemsError } = await supabaseAdmin
            .from('sales_order_items')
            .insert(orderItemsToInsert);

        if (itemsError) {
            // Rollback (Supabase JS doesn't have true transactions easily over REST, 
            // so we manually clean up the header record on fail)
            await supabaseAdmin.from('sales_orders').delete().eq('id', orderId);
            throw itemsError;
        }

        // 6. Auto-generate Pick List
        // Assign to no one initially, status Open.
        const { error: pickListError } = await supabaseAdmin
            .from('pick_lists')
            .insert({
                order_id: orderId,
                status: 'OPEN'
            });

        if (pickListError) {
            console.error("Warning: Order created but pick list auto-generation failed", pickListError);
            // We won't fail the whole request since the order is safely saved,
            // but managers will need to manually generate a pick list.
        }

        return NextResponse.json({
            success: true,
            message: "Order successfully imported via Webhook",
            internal_order_id: orderId,
            auto_generated_picklist: !pickListError
        }, { status: 201 });

    } catch (err: any) {
        console.error("Webhook Error:", err);
        return NextResponse.json({ success: false, error: err.message || "Internal server error" }, { status: 500 });
    }
}
