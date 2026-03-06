"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
    ArrowLeft,
    CheckCircle2,
    Loader2,
    PackageSearch,
    Barcode as BarcodeIcon,
    AlertCircle,
    X,
    Layers,
    ArrowRight
} from "lucide-react";
import Link from "next/link";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";

// Local state tracking for the sorting session
type SortItem = {
    product_id: string;
    sku: string;
    name: string;
    quantity: number;
    sorted_qty: number;
};

type SortBin = {
    order_id: string;
    order_number: string;
    customer_name: string;
    bin_number: number; // 1 to N
    items: SortItem[];
    isComplete: boolean;
};

type WaveInfo = {
    id: string;
    wave_number: string;
};

export default function SortingStationPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const supabase = createClient();
    const toast = useToast();
    const { id: waveId } = use(params);

    // Data State
    const [wave, setWave] = useState<WaveInfo | null>(null);
    const [bins, setBins] = useState<SortBin[]>([]);

    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Scanner Flow State
    const [showScanner, setShowScanner] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);

    // The dramatic prompt when an item is scanned
    const [activePrompt, setActivePrompt] = useState<{
        sku: string;
        name: string;
        targetBin: number;
        targetOrder: string;
    } | null>(null);

    useEffect(() => {
        fetchWaveAndOrders();
    }, [waveId]);

    const fetchWaveAndOrders = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Wave Info
            const { data: waveData, error: waveError } = await supabase
                .from('wave_picks')
                .select('id, wave_number')
                .eq('id', waveId)
                .single();

            if (waveError) throw waveError;
            setWave(waveData);

            // 2. Fetch all pick lists -> orders -> items linked to this wave
            const { data: pickLists, error: pickListsError } = await supabase
                .from('pick_lists')
                .select(`
                    order_id,
                    order:sales_orders (
                        order_number, customer_name,
                        items:sales_order_items (
                            product_id, quantity, product:products(sku, name)
                        )
                    )
                `)
                .eq('wave_id', waveId);

            if (pickListsError) throw pickListsError;

            // 3. Transform into Sort Bins (1 Bin per Order)
            let binCounter = 1;
            const initialBins: SortBin[] = [];

            for (const pl of (pickLists as any[])) {
                if (!pl.order || !pl.order.items) continue;

                const sortItems = pl.order.items.map((item: any) => ({
                    product_id: item.product_id,
                    sku: item.product.sku,
                    name: item.product.name,
                    quantity: item.quantity,
                    sorted_qty: 0
                }));

                initialBins.push({
                    order_id: pl.order_id,
                    order_number: pl.order.order_number,
                    customer_name: pl.order.customer_name,
                    bin_number: binCounter++,
                    items: sortItems,
                    isComplete: false
                });
            }

            setBins(initialBins);

        } catch (error) {
            console.error("Error fetching wave sorting details:", error);
            toast.error("Error", "Failed to load sorting station data.");
        } finally {
            setIsLoading(false);
        }
    };

    const isFullySorted = bins.length > 0 && bins.every(bin => bin.isComplete);
    const totalItems = bins.reduce((sum, bin) => sum + bin.items.reduce((s, i) => s + i.quantity, 0), 0);
    const sortedItemsCount = bins.reduce((sum, bin) => sum + bin.items.reduce((s, i) => s + i.sorted_qty, 0), 0);

    // --- SCANNER LOGIC ---

    const handleScanResult = async (scannedCode: string) => {
        setScanError(null);
        const sku = scannedCode.trim().toUpperCase();

        // 1. Find a bin that needs this SKU
        let targetBinIndex = -1;
        let targetItemIndex = -1;

        for (let b = 0; b < bins.length; b++) {
            const itemIdx = bins[b].items.findIndex(i => i.sku.toUpperCase() === sku && i.sorted_qty < i.quantity);
            if (itemIdx !== -1) {
                targetBinIndex = b;
                targetItemIndex = itemIdx;
                break;
            }
        }

        if (targetBinIndex === -1) {
            setScanError(`SKU ${sku} is not needed for any order in this wave, or is already fully sorted!`);
            try { new Audio('/beep.mp3').play().catch(() => { }); } catch (e) { }
            return;
        }

        // 2. Play Success Sound
        try { new Audio('/success.mp3').play().catch(() => { }); } catch (e) { }

        // 3. Flash Put-to-Wall Prompt
        const bin = bins[targetBinIndex];
        const item = bin.items[targetItemIndex];

        setActivePrompt({
            sku: item.sku,
            name: item.name,
            targetBin: bin.bin_number,
            targetOrder: bin.order_number
        });

        // 4. Update State behind the scenes
        const updatedBins = [...bins];
        updatedBins[targetBinIndex].items[targetItemIndex].sorted_qty += 1;

        // Check if bin is complete
        const binIsComplete = updatedBins[targetBinIndex].items.every(i => i.sorted_qty >= i.quantity);
        updatedBins[targetBinIndex].isComplete = binIsComplete;

        setBins(updatedBins);
        setShowScanner(false);
    };

    // ---------------------

    const handleConfirmPut = () => {
        setActivePrompt(null);
        // Automatically open scanner again if not fully sorted
        if (!isFullySorted) {
            setTimeout(() => setShowScanner(true), 300);
        }
    };

    const handleCompleteWaveSort = async () => {
        setIsSubmitting(true);
        try {
            const orderIds = bins.map(b => b.order_id);

            // Update Sales Orders to PACKED (Ready for Dispatch)
            await supabase
                .from('sales_orders')
                .update({ status: 'PACKED' })
                .in('id', orderIds);

            toast.success("Sorting Complete", "All orders are now packed and ready for dispatch.");
            router.push('/my-tasks');
        } catch (error) {
            console.error("Error completing sort:", error);
            toast.error("Finish Failed", "Failed to mark orders as packed.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 text-gray-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p>Loading sorting station lanes...</p>
            </div>
        );
    }

    if (!wave) return <div className="p-8 text-center text-red-500">Wave batch not found.</div>;

    // The dramatic prompt takes over the screen
    if (activePrompt) {
        return (
            <div className="fixed inset-0 bg-indigo-900 z-50 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-200">
                <div className="bg-white rounded-[3rem] p-12 max-w-2xl w-full shadow-2xl flex flex-col items-center">
                    <div className="w-32 h-32 bg-indigo-100 rounded-full flex items-center justify-center mb-8 shadow-inner border-8 border-indigo-50">
                        <span className="text-6xl font-black text-indigo-600">{activePrompt.targetBin}</span>
                    </div>

                    <h2 className="text-4xl font-black text-gray-900 mb-2 uppercase tracking-tight">Put 1 Unit in Bin {activePrompt.targetBin}</h2>
                    <p className="text-xl text-gray-500 font-medium mb-8">For Order {activePrompt.targetOrder}</p>

                    <div className="bg-gray-50 rounded-2xl p-6 w-full border border-gray-100 mb-10 text-left">
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Item Scanned</p>
                        <p className="text-2xl font-bold text-gray-900 leading-tight">{activePrompt.name}</p>
                        <p className="text-lg font-mono text-gray-500 mt-2">{activePrompt.sku}</p>
                    </div>

                    <button
                        onClick={handleConfirmPut}
                        className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-2xl hover:bg-indigo-700 transition-all shadow-[0_10px_40px_rgba(79,70,229,0.4)] hover:-translate-y-1 active:translate-y-1"
                    >
                        CONFIRM PUT
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col max-w-4xl mx-auto min-h-[calc(100vh-8rem)] animate-in fade-in duration-500 pb-24">

            {/* Header */}
            <div className="bg-white p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30 shadow-sm rounded-b-3xl">
                <div className="flex items-center gap-4">
                    <Link href="/my-tasks" className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight inline-flex items-center gap-2 text-gray-900">
                            <Layers className="w-6 h-6 text-indigo-600" /> Put-to-Wall Sorting
                        </h1>
                        <p className="text-sm text-gray-500 font-medium mt-1">Wave: <span className="font-mono text-indigo-600">{wave.wave_number}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
                    <div className="text-right">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Progress</p>
                        <p className="text-xl font-black text-gray-900">{sortedItemsCount} / {totalItems}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-100 flex items-center justify-center relative bg-white">
                        <svg className="absolute inset-0 w-full h-full -rotate-90 text-indigo-600" viewBox="0 0 36 36">
                            <path
                                className="opacity-20"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeDasharray={`${Math.round((sortedItemsCount / totalItems) * 100)}, 100`}
                            />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Main Sorting Dashboard */}
            <div className="flex-1 p-6">

                {isFullySorted ? (
                    <div className="flex flex-col items-center justify-center text-center p-12 space-y-6 bg-white rounded-3xl shadow-sm border border-gray-100 mt-10">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle2 className="w-12 h-12 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-gray-900">Sorting Complete!</h2>
                            <p className="text-lg text-gray-500 mt-2">All {bins.length} orders are packed and ready for dispatch.</p>
                        </div>
                        <button
                            onClick={handleCompleteWaveSort}
                            disabled={isSubmitting}
                            className="w-full max-w-md flex items-center justify-center gap-2 px-6 py-5 bg-gradient-to-r from-gray-900 to-black text-white rounded-2xl font-bold hover:shadow-xl transition-all hover:-translate-y-1 active:scale-95 text-lg"
                        >
                            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Complete Task <ArrowRight className="w-5 h-5" /></>}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Huge Scan Button */}
                        <button
                            onClick={() => setShowScanner(true)}
                            className="w-full py-8 bg-indigo-600 text-white rounded-[2rem] font-bold text-2xl flex flex-col justify-center items-center gap-4 shadow-[0_10px_40px_rgb(var(--indigo-600)/0.2)] hover:-translate-y-2 active:scale-95 transition-all mb-10 group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out tilt"></div>
                            <BarcodeIcon className="w-12 h-12" />
                            <span>Scan Next Item</span>
                        </button>

                        {/* Order Bins Visualizer */}
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-gray-400" /> Bin Status ({bins.filter(b => b.isComplete).length}/{bins.length} Complete)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                {bins.map(bin => {
                                    const binTotal = bin.items.reduce((s, i) => s + i.quantity, 0);
                                    const binSorted = bin.items.reduce((s, i) => s + i.sorted_qty, 0);

                                    return (
                                        <div key={bin.order_id} className={`relative p-5 rounded-3xl border-2 transition-all duration-500 ${bin.isComplete
                                            ? 'bg-emerald-50 border-emerald-200'
                                            : 'bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100'}`}>

                                            {bin.isComplete && (
                                                <div className="absolute -top-3 -right-3 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-md">
                                                    <CheckCircle2 className="w-5 h-5 text-white" />
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${bin.isComplete ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                                                    {bin.bin_number}
                                                </div>
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${bin.isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {binSorted}/{binTotal}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-gray-900 truncate">{bin.order_number}</p>
                                            <p className="text-xs text-gray-500 truncate mt-0.5">{bin.customer_name}</p>

                                            {/* Mini Progress Bar */}
                                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-4 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${bin.isComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                    style={{ width: `${(binSorted / binTotal) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
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
                    title="Put-to-Wall: Scan Item"
                    description="Scan the barcode of any item from the wave batch."
                />
            )}
        </div>
    );
}
