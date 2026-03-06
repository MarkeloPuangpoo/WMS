"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
    ArrowLeft,
    CheckCircle2,
    MapPin,
    Loader2,
    PackageSearch,
    QrCode,
    Barcode as BarcodeIcon,
    AlertCircle,
    X,
    CalendarDays,
    AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";

// Types
type LotRecommendation = {
    id: string;
    lot_number: string;
    exp_date: string | null;
    quantity: number;
};

type PickItem = {
    id: string;
    product_id: string;
    quantity: number;
    picked_quantity: number;
    product: {
        sku: string;
        name: string;
        location: {
            zone_name: string;
            bin_code: string;
        } | null;
    };
    isPicked: boolean;
    recommended_lot: LotRecommendation | null;
    all_lots: LotRecommendation[];
};

type OrderInfo = {
    id: string;
    order_number: string;
    customer_name: string;
    status: string;
};

// Scan Flow States
type ScanStep = 'SCAN_LOCATION' | 'SCAN_ITEM' | 'DONE';

export default function PickingPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const supabase = createClient();
    const toast = useToast();
    const { id } = use(params);

    // Data State
    const [order, setOrder] = useState<OrderInfo | null>(null);
    const [items, setItems] = useState<PickItem[]>([]);

    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Scanner Flow State
    const [showScanner, setShowScanner] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [scanStep, setScanStep] = useState<ScanStep>('SCAN_LOCATION');

    useEffect(() => {
        fetchOrderAndItems();
    }, [id]);

    const fetchOrderAndItems = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Order Info
            const { data: orderData, error: orderError } = await supabase
                .from('sales_orders')
                .select('id, order_number, customer_name, status')
                .eq('id', id)
                .single();

            if (orderError) throw orderError;
            setOrder(orderData);

            // 2. Fetch Order Items + Product Details + Locations
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
                        location:locations (zone_name, bin_code)
                    )
                `)
                .eq('order_id', id);

            if (itemsError) throw itemsError;

            // 3. Smart Sorting: Map and sort by Zone, then Bin Code
            const sortedItems = (itemsData as any[]).map(item => ({
                ...item,
                isPicked: item.picked_quantity >= item.quantity // Mark as picked if full quantity is met
            })).sort((a, b) => {
                const zoneA = a.product?.location?.zone_name || 'ZZZ'; // Push nulls to bottom
                const zoneB = b.product?.location?.zone_name || 'ZZZ';
                if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);

                const binA = a.product?.location?.bin_code || 'ZZZ';
                const binB = b.product?.location?.bin_code || 'ZZZ';
                return binA.localeCompare(binB);
            });

            setItems(sortedItems);

            // FEFO: Fetch lot recommendations for each item
            const itemsWithLots = await Promise.all(sortedItems.map(async (item: any) => {
                const { data: lotsData } = await supabase
                    .from('inventory_lots')
                    .select('id, lot_number, exp_date, quantity')
                    .eq('product_id', item.product_id)
                    .gt('quantity', 0)
                    .order('exp_date', { ascending: true });

                const lots = (lotsData || []) as LotRecommendation[];
                return {
                    ...item,
                    recommended_lot: lots.length > 0 ? lots[0] : null,
                    all_lots: lots
                };
            }));

            setItems(itemsWithLots);

            // Find the first unpicked item to start the flow
            const firstUnpicked = itemsWithLots.findIndex((i: any) => !i.isPicked);
            if (firstUnpicked !== -1) {
                setCurrentItemIndex(firstUnpicked);
            } else {
                setScanStep('DONE');
            }

            // 4. Ensure Pick List status is 'IN_PROGRESS' and claim the task
            const { data: { user } } = await supabase.auth.getUser();

            if (orderData.status === 'PENDING') {
                await supabase.from('sales_orders').update({ status: 'PICKING' }).eq('id', id);
            }

            // Always try to claim it if it's currently unassigned and we're starting.
            if (user) {
                await supabase.from('pick_lists')
                    .update({
                        status: 'IN_PROGRESS',
                        started_at: new Date().toISOString(),
                        assigned_to: user.id
                    })
                    .eq('order_id', id)
                    .is('assigned_to', null);
            }

        } catch (error) {
            console.error("Error fetching picking details:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const currentItem = items[currentItemIndex];
    const isCompleted = items.length > 0 && items.every(item => item.isPicked);

    // --- SCANNER LOGIC ---

    const handleScanResult = async (scannedCode: string) => {
        setScanError(null);

        if (scanStep === 'SCAN_LOCATION') {
            const expectedBin = currentItem.product.location?.bin_code;
            if (!expectedBin) {
                // Fallback if item has no location data master
                setScanStep('SCAN_ITEM');
                setShowScanner(false);
                return;
            }

            if (scannedCode.trim().toUpperCase() === expectedBin.toUpperCase()) {
                // Correct Location! Move to scan item
                setScanStep('SCAN_ITEM');
                // Play success sound
                try { new Audio('/success.mp3').play().catch(() => { }); } catch (e) { }
            } else {
                setScanError(`Wrong Location! You scanned: ${scannedCode}. Expected: ${expectedBin}`);
            }
        }
        else if (scanStep === 'SCAN_ITEM') {
            const expectedSKU = currentItem.product.sku;

            if (scannedCode.trim().toUpperCase() === expectedSKU.toUpperCase()) {
                // Correct Item! Mark as picked.
                try { new Audio('/success.mp3').play().catch(() => { }); } catch (e) { }

                // Update local state
                const updatedItems = [...items];
                updatedItems[currentItemIndex].isPicked = true;
                updatedItems[currentItemIndex].picked_quantity = updatedItems[currentItemIndex].quantity;
                setItems(updatedItems);

                // Update DB: sales_order_items
                supabase.from('sales_order_items')
                    .update({ picked_quantity: updatedItems[currentItemIndex].quantity })
                    .eq('id', currentItem.id)
                    .then();

                // FEFO: Decrement lot quantity in inventory_lots
                const lot = currentItem.recommended_lot;
                if (lot) {
                    const newLotQty = Math.max(0, lot.quantity - currentItem.quantity);
                    supabase.from('inventory_lots')
                        .update({ quantity: newLotQty })
                        .eq('id', lot.id)
                        .then();
                }

                setShowScanner(false); // Close scanner modal

                // Advance to next unpicked item
                const nextUnpicked = updatedItems.findIndex(i => !i.isPicked);
                if (nextUnpicked !== -1) {
                    setCurrentItemIndex(nextUnpicked);
                    setScanStep('SCAN_LOCATION');
                } else {
                    setScanStep('DONE');
                }
            } else {
                setScanError(`Wrong Item! You scanned SKU: ${scannedCode}. Expected SKU: ${expectedSKU}`);
            }
        }
    };

    // ---------------------

    const handleCompletePicking = async () => {
        setIsSubmitting(true);
        try {
            // Update Pick List to COMPLETED
            await supabase
                .from('pick_lists')
                .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
                .eq('order_id', id);

            // Update Sales Order to PACKED (Ready for shipping)
            await supabase
                .from('sales_orders')
                .update({ status: 'PACKED' })
                .eq('id', id);

            router.push('/inventory/outbound');
        } catch (error) {
            console.error("Error completing pick list:", error);
            toast.error("Pick Failed", "Failed to complete pick list.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const progressText = `${items.filter(i => i.isPicked).length} / ${items.length} Picked`;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 text-gray-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p>Loading optimal pick route...</p>
            </div>
        );
    }

    if (!order) return <div className="p-8 text-center text-red-500">Order not found.</div>;

    return (
        <div className="flex flex-col max-w-md mx-auto min-h-[calc(100vh-8rem)] animate-in fade-in duration-500">

            {/* Header */}
            <div className="bg-white p-4 border-b flex items-center gap-3 sticky top-0 z-30">
                <Link href="/inventory/outbound" className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">Active Picking</h1>
                    <p className="text-sm text-gray-500 font-medium">Order: <span className="text-primary-700">{order.order_number}</span></p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-black text-primary-600">{Math.round((items.filter(i => i.isPicked).length / items.length) * 100) || 0}%</div>
                </div>
            </div>

            {/* Smart Scanning Flow UI */}
            <div className="flex-1 p-4 flex flex-col gap-4">

                {isCompleted || scanStep === 'DONE' ? (

                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle2 className="w-12 h-12 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">All Items Picked!</h2>
                            <p className="text-gray-500 mt-2">The order is complete and ready for packing.</p>
                        </div>
                        <button
                            onClick={handleCompletePicking}
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl hover:-translate-y-1 active:scale-95 text-lg"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete Pick List"}
                        </button>
                    </div>

                ) : currentItem && (

                    <div className="flex-1 flex flex-col">

                        {/* Current Task Card */}
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">

                            {/* Priority Banner */}
                            <div className="bg-primary-600 text-white px-5 py-3 flex justify-between items-center">
                                <span className="text-sm font-bold uppercase tracking-widest opacity-90">Pick Task {currentItemIndex + 1} of {items.length}</span>
                                <span className="text-xs bg-black/20 px-2 py-1 rounded-full font-mono">{currentItem.product.sku}</span>
                            </div>

                            <div className="p-6 flex-1 flex flex-col justify-center space-y-8">

                                {/* Target Location UI */}
                                <div className={`transition-all duration-300 ${scanStep === 'SCAN_LOCATION' ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}`}>
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${scanStep === 'SCAN_LOCATION' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                            <MapPin className={`w-6 h-6 ${scanStep === 'SCAN_LOCATION' ? 'text-blue-600' : 'text-gray-400'}`} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">Step 1: Go to location</p>
                                            <p className={`text-4xl font-black ${scanStep === 'SCAN_LOCATION' ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {currentItem.product.location?.bin_code || 'Unassigned'}
                                            </p>
                                            {currentItem.product.location?.zone_name && (
                                                <p className="text-sm text-gray-500 font-medium mt-1">Zone: {currentItem.product.location.zone_name}</p>
                                            )}
                                        </div>
                                    </div>

                                    {scanStep === 'SCAN_LOCATION' && currentItem.product.location && (
                                        <button
                                            onClick={() => setShowScanner(true)}
                                            className="mt-6 w-full py-4 bg-blue-50 text-blue-700 rounded-xl font-bold text-lg flex justify-center items-center gap-2 border-2 border-blue-200 active:bg-blue-100 transition-colors"
                                        >
                                            <QrCode className="w-6 h-6" /> Scan Location QR
                                        </button>
                                    )}

                                    {/* Override fallback logic incase QR is broken */}
                                    {scanStep === 'SCAN_LOCATION' && (
                                        <button onClick={() => setScanStep('SCAN_ITEM')} className="w-full mt-3 text-center text-sm font-semibold text-gray-400 hover:text-gray-600 underline underline-offset-4">
                                            Skip Location Scan (Override)
                                        </button>
                                    )}
                                </div>


                                {/* Divider */}
                                <div className="h-px bg-gray-100 w-full relative">
                                    <div className="absolute left-1/2 -top-3 -translate-x-1/2 bg-white px-2">
                                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                            <ArrowLeft className="w-3 h-3 text-gray-400 -rotate-90" />
                                        </div>
                                    </div>
                                </div>


                                {/* Target Item UI */}
                                <div className={`transition-all duration-300 ${scanStep === 'SCAN_ITEM' ? 'opacity-100 scale-100' : 'opacity-40 scale-95 pointer-events-none'}`}>
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${scanStep === 'SCAN_ITEM' ? 'bg-primary-100' : 'bg-gray-100'}`}>
                                            <PackageSearch className={`w-6 h-6 ${scanStep === 'SCAN_ITEM' ? 'text-primary-600' : 'text-gray-400'}`} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">Step 2: Pick Item</p>
                                            <p className={`text-2xl font-bold leading-tight ${scanStep === 'SCAN_ITEM' ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {currentItem.product.name}
                                            </p>
                                            <div className="mt-2 inline-flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                                                <span className="text-xs font-semibold text-gray-500 uppercase">QTY to Pick:</span>
                                                <span className="text-lg font-black text-gray-900">{currentItem.quantity}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* FEFO Lot Recommendation */}
                                    {currentItem.recommended_lot && (
                                        <div className={`mt-4 p-4 rounded-xl border-2 transition-all ${currentItem.recommended_lot.exp_date && new Date(currentItem.recommended_lot.exp_date) <= new Date()
                                            ? 'bg-red-50 border-red-200'
                                            : currentItem.recommended_lot.exp_date && (new Date(currentItem.recommended_lot.exp_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 30
                                                ? 'bg-amber-50 border-amber-200'
                                                : 'bg-emerald-50 border-emerald-200'
                                            }`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <CalendarDays className="w-4 h-4 text-gray-600" />
                                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">FEFO Recommendation</span>
                                                {currentItem.recommended_lot.exp_date && (new Date(currentItem.recommended_lot.exp_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 30 && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        {new Date(currentItem.recommended_lot.exp_date) <= new Date() ? 'EXPIRED' : 'EXPIRING SOON'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-3 gap-3 text-center">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 font-medium uppercase">Lot</p>
                                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{currentItem.recommended_lot.lot_number}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 font-medium uppercase">Expires</p>
                                                    <p className="text-sm font-bold text-gray-900 mt-0.5">
                                                        {currentItem.recommended_lot.exp_date
                                                            ? new Date(currentItem.recommended_lot.exp_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
                                                            : 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 font-medium uppercase">Avail</p>
                                                    <p className="text-sm font-bold text-gray-900 mt-0.5">{currentItem.recommended_lot.quantity}</p>
                                                </div>
                                            </div>
                                            {currentItem.all_lots.length > 1 && (
                                                <p className="text-[10px] text-gray-500 mt-2 text-center">
                                                    +{currentItem.all_lots.length - 1} more lot{currentItem.all_lots.length - 1 > 1 ? 's' : ''} available
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {scanStep === 'SCAN_ITEM' && (
                                        <button
                                            onClick={() => setShowScanner(true)}
                                            className="mt-6 w-full py-5 bg-primary-600 text-white rounded-2xl font-bold text-xl flex justify-center items-center gap-3 shadow-[0_8px_30px_rgb(var(--primary-600)/0.3)] hover:-translate-y-1 active:scale-95 transition-all"
                                        >
                                            <BarcodeIcon className="w-8 h-8" /> Scan Barcode
                                        </button>
                                    )}
                                </div>

                            </div>
                        </div>

                    </div>
                )}
            </div>

            {/* Error Overlay (Outside scanner modal for generic errors if needed, though scanner has its own) */}
            {scanError && (
                <div className="fixed bottom-4 left-4 right-4 bg-red-600 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-start gap-3 animate-in slide-in-from-bottom">
                    <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 opacity-90" />
                    <div className="flex-1">
                        <p className="font-bold">Scan Error</p>
                        <p className="text-red-100 text-sm">{scanError}</p>
                    </div>
                    <button onClick={() => setScanError(null)} className="p-1 bg-red-700 hover:bg-red-800 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Fullscreen Camera Scanner UI */}
            {showScanner && (
                <BarcodeScanner
                    onScan={handleScanResult}
                    onClose={() => setShowScanner(false)}
                    title={scanStep === 'SCAN_LOCATION' ? 'Scan Location QR' : 'Scan Product Barcode'}
                    description={scanStep === 'SCAN_LOCATION' ? `Find and scan the QR code for Bin: ${currentItem?.product?.location?.bin_code}` : `Find and scan the Barcode for SKU: ${currentItem?.product?.sku}`}
                />
            )}
        </div>
    );
}
