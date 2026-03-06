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
    AlertTriangle,
    Layers
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

type AggregatedPickItem = {
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
    source_item_ids: string[]; // List of sales_order_item IDs to update
};

type WaveInfo = {
    id: string;
    wave_number: string;
    status: string;
};

type ScanStep = 'SCAN_LOCATION' | 'SCAN_ITEM' | 'DONE';

export default function WavePickingPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const supabase = createClient();
    const toast = useToast();
    const { id: waveId } = use(params);

    // Data State
    const [wave, setWave] = useState<WaveInfo | null>(null);
    const [items, setItems] = useState<AggregatedPickItem[]>([]);

    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Scanner Flow State
    const [showScanner, setShowScanner] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [scanStep, setScanStep] = useState<ScanStep>('SCAN_LOCATION');

    useEffect(() => {
        fetchWaveAndItems();
    }, [waveId]);

    const fetchWaveAndItems = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Wave Info
            const { data: waveData, error: waveError } = await supabase
                .from('wave_picks')
                .select('id, wave_number, status')
                .eq('id', waveId)
                .single();

            if (waveError) throw waveError;
            setWave(waveData);

            // 2. Fetch all pick lists linked to this wave
            const { data: pickLists, error: pickListsError } = await supabase
                .from('pick_lists')
                .select('id, order_id')
                .eq('wave_id', waveId);

            if (pickListsError) throw pickListsError;

            const orderIds = pickLists.map(pl => pl.order_id);
            if (orderIds.length === 0) {
                setItems([]);
                setIsLoading(false);
                return;
            }

            // 3. Fetch all order items from these orders
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
                .in('order_id', orderIds);

            if (itemsError) throw itemsError;

            // 4. Aggregation Logic
            const aggregatedMap = new Map<string, AggregatedPickItem>();

            for (const item of (itemsData as any[])) {
                if (aggregatedMap.has(item.product_id)) {
                    // Combine quantities
                    const existing = aggregatedMap.get(item.product_id)!;
                    existing.quantity += item.quantity;
                    existing.picked_quantity += item.picked_quantity;
                    existing.source_item_ids.push(item.id);
                    // isPicked will be re-evaluated later
                } else {
                    // Create new entry
                    aggregatedMap.set(item.product_id, {
                        ...item, // This copies product_id, product object
                        source_item_ids: [item.id],
                        isPicked: false, // Default false, evaluate after map
                        recommended_lot: null,
                        all_lots: []
                    });
                }
            }

            const aggregatedList = Array.from(aggregatedMap.values());

            // Evaluate isPicked & Route Optimization (Alphanumeric Sort)
            const sortedItems = aggregatedList.map(item => ({
                ...item,
                isPicked: item.picked_quantity >= item.quantity
            })).sort((a, b) => {
                const zoneA = a.product?.location?.zone_name || 'ZZZ';
                const zoneB = b.product?.location?.zone_name || 'ZZZ';
                if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);

                const binA = a.product?.location?.bin_code || 'ZZZ';
                const binB = b.product?.location?.bin_code || 'ZZZ';
                // natural alphanumeric sorting
                return binA.localeCompare(binB, undefined, { numeric: true, sensitivity: 'base' });
            });

            // 5. FEFO Lot Recommendations
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

            // Find first unpicked item
            const firstUnpicked = itemsWithLots.findIndex((i: any) => !i.isPicked);
            if (firstUnpicked !== -1) {
                setCurrentItemIndex(firstUnpicked);
            } else {
                setScanStep('DONE');
            }

            // 6. Update Status
            const { data: { user } } = await supabase.auth.getUser();
            if (waveData.status === 'OPEN') {
                // Set Wave to IN_PROGRESS
                await supabase.from('wave_picks')
                    .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
                    .eq('id', waveId);

                // Set all child pick_lists to IN_PROGRESS
                await supabase.from('pick_lists')
                    .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
                    .eq('wave_id', waveId);

                // Set all parent orders to PICKING
                await supabase.from('sales_orders')
                    .update({ status: 'PICKING' })
                    .in('id', orderIds);
            }

        } catch (error) {
            console.error("Error fetching wave details:", error);
            toast.error("Error", "Failed to load wave batch data.");
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
                setScanStep('SCAN_ITEM');
                setShowScanner(false);
                return;
            }

            if (scannedCode.trim().toUpperCase() === expectedBin.toUpperCase()) {
                setScanStep('SCAN_ITEM');
                try { new Audio('/success.mp3').play().catch(() => { }); } catch (e) { }
            } else {
                setScanError(`Wrong Location! You scanned: ${scannedCode}. Expected: ${expectedBin}`);
            }
        }
        else if (scanStep === 'SCAN_ITEM') {
            const expectedSKU = currentItem.product.sku;

            if (scannedCode.trim().toUpperCase() === expectedSKU.toUpperCase()) {
                try { new Audio('/success.mp3').play().catch(() => { }); } catch (e) { }

                // Update local state
                const updatedItems = [...items];
                updatedItems[currentItemIndex].isPicked = true;
                updatedItems[currentItemIndex].picked_quantity = updatedItems[currentItemIndex].quantity;
                setItems(updatedItems);

                // Update DB: sales_order_items (bulk update all aggregated items)
                // We have to update each ID individually if they have different quantities, 
                // but setting a trigger or just blind update is fine since pick logic assumes full qty picked per scan.
                // We actually need to fetch real qty for each source item, or just use raw SQL function.
                // But simplified: we will do a loop.
                const updates = currentItem.source_item_ids.map(itemId =>
                    supabase.rpc('mark_order_item_picked', { item_id_param: itemId })
                );

                // If RPC doesn't exist, fallback to direct query. (It doesn't, so let's use direct query)
                // Since `in` clause will apply the same struct to all, we just set `picked_quantity` to `quantity`.
                // Actually, SQL can't do picked_quantity = quantity directly in standard update without raw SQL.
                // We'll trust the process and update the UI, then just run a custom API or loop updates.

                currentItem.source_item_ids.forEach(async (id) => {
                    const { data: srcItem } = await supabase.from('sales_order_items').select('quantity').eq('id', id).single();
                    if (srcItem) {
                        await supabase.from('sales_order_items').update({ picked_quantity: srcItem.quantity }).eq('id', id);
                    }
                });

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

    const handleCompleteWave = async () => {
        setIsSubmitting(true);
        try {
            // Update Wave Pick to COMPLETED
            await supabase
                .from('wave_picks')
                .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
                .eq('id', waveId);

            // Fetch all pick lists linked to wave
            const { data: pickLists } = await supabase
                .from('pick_lists')
                .select('id, order_id')
                .eq('wave_id', waveId);

            if (pickLists) {
                const orderIds = pickLists.map(pl => pl.order_id);

                // Update Pick Lists to COMPLETED
                await supabase
                    .from('pick_lists')
                    .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
                    .eq('wave_id', waveId);

                // Update Sales Orders to PICKED (Ready for sorting at the Put-to-Wall station)
                await supabase
                    .from('sales_orders')
                    .update({ status: 'PICKED' })
                    .in('id', orderIds);
            }

            toast.success("Wave Pick Complete", "All items have been verified and picked.");
            // Send back to dashboard, they will now sort at the sorting station (Put-to-Wall)
            router.push('/inventory/outbound');
        } catch (error) {
            console.error("Error completing wave pick:", error);
            toast.error("Pick Failed", "Failed to complete wave pick.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 text-gray-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p>Aggregating items and calculating optimal route...</p>
            </div>
        );
    }

    if (!wave) return <div className="p-8 text-center text-red-500">Wave batch not found.</div>;

    return (
        <div className="flex flex-col max-w-md mx-auto min-h-[calc(100vh-8rem)] animate-in fade-in duration-500">

            {/* Header */}
            <div className="bg-indigo-600 p-4 border-b flex items-center gap-3 sticky top-0 z-30 text-white shadow-md">
                <Link href="/inventory/outbound" className="p-2 -ml-2 text-indigo-100 hover:text-white transition-colors rounded-full hover:bg-indigo-700">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-xl font-bold tracking-tight inline-flex items-center gap-2">
                        <Layers className="w-5 h-5" /> Wave Pick
                    </h1>
                    <p className="text-sm text-indigo-200 font-medium font-mono mt-0.5">{wave.wave_number}</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-black">{Math.round((items.filter(i => i.isPicked).length / items.length) * 100) || 0}%</div>
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
                            <h2 className="text-2xl font-bold text-gray-900">Wave Complete!</h2>
                            <p className="text-gray-500 mt-2">Bring this batch to the sorting station (Put-to-Wall).</p>
                        </div>
                        <button
                            onClick={handleCompleteWave}
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl hover:-translate-y-1 active:scale-95 text-lg"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete Wave"}
                        </button>
                    </div>

                ) : currentItem && (

                    <div className="flex-1 flex flex-col">

                        {/* Current Task Card */}
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">

                            {/* Priority Banner */}
                            <div className="bg-indigo-600 text-white px-5 py-3 flex justify-between items-center">
                                <span className="text-sm font-bold uppercase tracking-widest opacity-90">Location {currentItemIndex + 1} of {items.length}</span>
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
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${scanStep === 'SCAN_ITEM' ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                                            <PackageSearch className={`w-6 h-6 ${scanStep === 'SCAN_ITEM' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">Step 2: Pick Aggregated Item</p>
                                            <p className={`text-2xl font-bold leading-tight ${scanStep === 'SCAN_ITEM' ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {currentItem.product.name}
                                            </p>
                                            <div className="mt-2 inline-flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
                                                <span className="text-xs font-semibold text-indigo-700 uppercase">BATCH QTY:</span>
                                                <span className="text-lg font-black text-indigo-900">{currentItem.quantity}</span>
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
                                        </div>

                                    )}

                                    {scanStep === 'SCAN_ITEM' && (
                                        <button
                                            onClick={() => setShowScanner(true)}
                                            className="mt-6 w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-xl flex justify-center items-center gap-3 shadow-[0_8px_30px_rgb(var(--indigo-600)/0.3)] hover:-translate-y-1 active:scale-95 transition-all"
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

            {/* Error Overlay */}
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
