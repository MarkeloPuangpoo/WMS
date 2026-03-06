"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
    PackageCheck,
    ArrowLeft,
    Truck,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Box
} from "lucide-react";
import Link from "next/link";

type OrderItem = {
    id: string;
    product_id: string;
    quantity: number;
    picked_quantity: number;
    product: {
        sku: string;
        name: string;
        location_id: string | null;
        location: {
            bin_code: string;
        } | null;
    };
};

type OrderInfo = {
    id: string;
    order_number: string;
    customer_name: string;
    status: string;
};

export default function ShippingPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const supabase = createClient();
    const toast = useToast();
    const { id } = use(params);

    const [order, setOrder] = useState<OrderInfo | null>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // UI State for QC Checkboxes
    const [qcChecked, setQcChecked] = useState<string[]>([]);

    useEffect(() => {
        fetchOrderAndItems();
    }, [id]);

    const fetchOrderAndItems = async () => {
        setIsLoading(true);
        try {
            const { data: orderData, error: orderError } = await supabase
                .from('sales_orders')
                .select('id, order_number, customer_name, status')
                .eq('id', id)
                .single();

            if (orderError) throw orderError;
            setOrder(orderData);

            const { data: itemsData, error: itemsError } = await supabase
                .from('sales_order_items')
                .select(`
                    id, 
                    product_id, 
                    quantity, 
                    picked_quantity,
                    product:products (
                        sku, 
                        name,
                        location_id,
                        location:locations (bin_code)
                    )
                `)
                .eq('order_id', id);

            if (itemsError) throw itemsError;
            setItems(itemsData as any[]);

        } catch (error) {
            console.error("Error fetching shipping details:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleQC = (itemId: string) => {
        setQcChecked(prev =>
            prev.includes(itemId)
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId]
        );
    };

    const allChecked = qcChecked.length === items.length && items.length > 0;
    const hasShortage = items.some(item => item.picked_quantity < item.quantity);

    const handleConfirmShipment = async () => {
        if (!allChecked) {
            toast.warning("QC Incomplete", "Please complete the QC checklist for all items before shipping.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // 1. Create OUTBOUND Transactions
            // We loop through items. If picked_quantity > 0, we deduct that amount from inventory.
            const transactions = items
                .filter(item => item.picked_quantity > 0)
                .map(item => ({
                    transaction_type: 'OUTBOUND',
                    product_id: item.product_id,
                    location_id: item.product.location_id, // assuming it's picked from its designated location
                    quantity: -(item.picked_quantity), // Negative for outbound
                    reference_doc: order?.order_number,
                    notes: `Shipped order ${order?.order_number}`,
                    created_by: user.id
                }));

            if (transactions.length > 0) {
                // Determine missing location_ids and alert?
                const invalidTrans = transactions.find(t => !t.location_id);
                if (invalidTrans) {
                    throw new Error("One or more products missing location_id for transaction.");
                }

                const { error: txError } = await supabase
                    .from('inventory_transactions')
                    .insert(transactions);

                if (txError) throw txError;
            }

            // 2. Update Order Status to SHIPPED
            const { error: orderError } = await supabase
                .from('sales_orders')
                .update({ status: 'SHIPPED' })
                .eq('id', id);

            if (orderError) throw orderError;

            // 3. Auto-Trigger Outbound Webhooks (E-commerce Sync)
            try {
                // Fetch active webhooks for this event
                const { data: webhooks } = await supabase
                    .from('webhook_endpoints')
                    .select('*')
                    .eq('event_type', 'ORDER_SHIPPED')
                    .eq('is_active', true);

                if (webhooks && webhooks.length > 0) {
                    const payload = {
                        event: 'ORDER_SHIPPED',
                        data: {
                            order_number: order?.order_number,
                            external_order_id: (order as any)?.external_order_id || null,
                            status: 'SHIPPED',
                            shipped_at: new Date().toISOString()
                        }
                    };

                    // Send requests in parallel without blocking UI response
                    webhooks.forEach(async (webhook) => {
                        const startTime = Date.now();
                        try {
                            const res = await fetch(webhook.url, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(webhook.secret ? { 'x-webhook-signature': webhook.secret } : {})
                                },
                                body: JSON.stringify(payload)
                            });

                            const duration = Date.now() - startTime;
                            const responseText = await res.text().catch(() => '');

                            // Log Success
                            await supabase.from('webhook_logs').insert({
                                webhook_id: webhook.id,
                                event_type: webhook.event_type,
                                payload,
                                response_status: res.status,
                                response_body: responseText.substring(0, 500),
                                is_success: res.ok,
                                execution_time_ms: duration
                            });

                        } catch (webhookErr: any) {
                            // Log Network Failure
                            await supabase.from('webhook_logs').insert({
                                webhook_id: webhook.id,
                                event_type: webhook.event_type,
                                payload,
                                response_status: 0,
                                response_body: webhookErr.message || 'Network fetch failed',
                                is_success: false,
                                execution_time_ms: Date.now() - startTime
                            });
                        }
                    });
                }
            } catch (syncErr) {
                console.error("Non-fatal error in webhook sync:", syncErr);
                // We don't throw here because the core shipment was successful.
            }

            toast.success("Shipment Confirmed", "Inventory deducted and sync triggered.");
            router.push('/inventory/outbound');

        } catch (error: any) {
            console.error("Shipping error:", error);
            toast.error("Shipping Failed", error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 text-gray-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p>Loading shipment details...</p>
            </div>
        );
    }

    if (!order) return <div className="p-8 text-center text-red-500">Order not found.</div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500 pb-20">

            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/inventory/outbound" className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        Packing & Shipping
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Order: <span className="font-semibold text-gray-700">{order.order_number}</span> • {order.customer_name}</p>
                </div>
            </div>

            {hasShortage && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3 text-orange-800">
                    <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                    <div className="text-sm">
                        <p className="font-semibold mb-1">Shortage Detected</p>
                        <p className="text-orange-700/80">Some items were not fully picked. Proceeding will "short-ship" this order.</p>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* QC Checklist Table */}
                <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <PackageCheck className="w-5 h-5 text-purple-600" />
                            QC Verification Checklist
                        </h2>
                        <span className="text-sm text-gray-500">{qcChecked.length} / {items.length} Checked</span>
                    </div>

                    <div className="divide-y divide-gray-100">
                        {items.map((item) => {
                            const isChecked = qcChecked.includes(item.id);
                            const isShort = item.picked_quantity < item.quantity;

                            return (
                                <label key={item.id} className={`flex items-start gap-4 p-5 cursor-pointer transition-colors hover:bg-gray-50 ${isChecked ? 'bg-purple-50/30' : ''}`}>
                                    <div className="pt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleQC(item.id)}
                                            className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 transition-colors"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className={`font-medium ${isChecked ? 'text-gray-900' : 'text-gray-700'}`}>{item.product.name}</p>
                                            <div className="text-right">
                                                <span className={`font-bold ${isShort ? 'text-orange-600' : 'text-gray-900'}`}>
                                                    {item.picked_quantity}
                                                </span>
                                                <span className="text-gray-400 text-sm"> / {item.quantity}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 font-mono">{item.product.sku}</p>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {/* Summary & Action */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h3 className="font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-3">Shipment Summary</h3>

                        <div className="space-y-3 text-sm mb-6">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Carrier Protocol</span>
                                <span className="font-medium text-gray-900">Standard</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Total Items</span>
                                <span className="font-medium text-gray-900">{items.reduce((acc, curr) => acc + curr.picked_quantity, 0)} Units</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Origin Bin</span>
                                <span className="font-medium text-gray-900">Multi-Location</span>
                            </div>
                        </div>

                        <button
                            onClick={handleConfirmShipment}
                            disabled={isSubmitting || !allChecked}
                            className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold shadow-sm transition-all ${allChecked
                                ? 'bg-purple-600 hover:bg-purple-700 text-white hover:shadow-md hover:-translate-y-0.5'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                } disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none`}
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                            ) : (
                                <>
                                    Confirm Shipment
                                    <Truck className="w-5 h-5" />
                                </>
                            )}
                        </button>

                        <Link
                            href={`/inventory/outbound/${order.id}/waybill`}
                            target="_blank"
                            className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                        >
                            Print Internal Waybill
                        </Link>

                        {!allChecked && (
                            <p className="text-center text-xs text-gray-400 mt-3">
                                Please tick all QC checkboxes to enable shipping.
                            </p>
                        )}
                    </div>

                    <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-4 flex items-start gap-3">
                        <Box className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-800 leading-relaxed">
                            Confirming shipment will automatically generate OUTBOUND ledger transactions and deduct real-time inventory quantities.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
