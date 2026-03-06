"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
    PackagePlus,
    ArrowRight,
    CheckCircle2,
    MapPin,
    Loader2,
    Search,
    Package,
    ArrowLeft,
    Trash2,
    Plus,
    CalendarDays
} from "lucide-react";

// Types
type Product = { id: string; sku: string; name: string; location_id: string | null };
type Location = { id: string; zone_name: string; bin_code: string };
type InboundItem = {
    product: Product;
    quantity: number;
    lot_number: string;
    mfg_date: string;
    exp_date: string;
    suggested_location?: Location | null;
    selected_location?: Location | null;
};

export default function InboundPage() {
    const router = useRouter();
    const supabase = createClient();
    const toast = useToast();
    const [step, setStep] = useState<1 | 2>(1);
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [referenceDoc, setReferenceDoc] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<InboundItem[]>([]);

    // Master Data
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch master data on load
    useEffect(() => {
        const fetchData = async () => {
            const [
                { data: productsData },
                { data: locationsData }
            ] = await Promise.all([
                supabase.from('products').select('id, sku, name, location_id'),
                supabase.from('locations').select('id, zone_name, bin_code')
            ]);

            if (productsData) setProducts(productsData);
            if (locationsData) setLocations(locationsData);
        };
        fetchData();
    }, []);

    // Helper: Add item to list
    const handleAddItem = (product: Product) => {
        if (!items.find(item => item.product.id === product.id)) {
            setItems([...items, { product, quantity: 1, lot_number: '', mfg_date: '', exp_date: '' }]);
        }
        setSearchQuery("");
    };

    // Helper: Update item quantity
    const handleUpdateQuantity = (productId: string, quantity: number) => {
        setItems(items.map(item =>
            item.product.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
        ));
    };

    // Helper: Remove item
    const handleRemoveItem = (productId: string) => {
        setItems(items.filter(item => item.product.id !== productId));
    };

    // Helper: Update lot field
    const handleUpdateLotField = (productId: string, field: 'lot_number' | 'mfg_date' | 'exp_date', value: string) => {
        setItems(items.map(item =>
            item.product.id === productId ? { ...item, [field]: value } : item
        ));
    };

    // Helper: Update Location for Putaway
    const handleUpdateLocation = (productId: string, locationId: string) => {
        const loc = locations.find(l => l.id === locationId) || null;
        setItems(items.map(item =>
            item.product.id === productId ? { ...item, selected_location: loc } : item
        ));
    };

    // Proceed to Putaway Step
    const handleNextStep = () => {
        if (!referenceDoc.trim()) {
            toast.warning("Missing Document", "Please enter a Reference Document (PO Number)");
            return;
        }
        if (items.length === 0) {
            toast.warning("No Items", "Please add at least one item to receive.");
            return;
        }
        // Validate lot fields
        const missingLot = items.find(item => !item.lot_number.trim());
        if (missingLot) {
            toast.warning("Missing Lot Number", `Please enter a Lot Number for: ${missingLot.product.name}`);
            return;
        }
        const missingExp = items.find(item => !item.exp_date);
        if (missingExp) {
            toast.warning("Missing Expiry Date", `Please enter an Expiry Date for: ${missingExp.product.name}`);
            return;
        }

        // Prepare Putaway data: Auto-suggest locations
        const itemsWithSuggestions = items.map(item => {
            const suggested = item.product.location_id
                ? locations.find(l => l.id === item.product.location_id) || null
                : null;
            return {
                ...item,
                suggested_location: suggested,
                selected_location: suggested // Default to suggestion
            };
        });

        setItems(itemsWithSuggestions);
        setStep(2);
    };

    // Finalize Transaction
    const handleConfirm = async () => {
        // Validate all items have locations
        const missingLocations = items.filter(item => !item.selected_location);
        if (missingLocations.length > 0) {
            toast.warning("Missing Location", "Please assign a location for all items.");
            return;
        }

        setIsLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            // Prepare transaction records
            const transactionsToInsert = items.map(item => ({
                transaction_type: 'INBOUND',
                product_id: item.product.id,
                location_id: item.selected_location!.id,
                quantity: item.quantity,
                reference_doc: referenceDoc,
                notes: notes,
                lot_number: item.lot_number,
                created_by: user.id
            }));

            // Insert into Supabase
            const { error } = await supabase
                .from('inventory_transactions')
                .insert(transactionsToInsert);

            if (error) throw error;

            // Upsert inventory_lots: add quantity to existing lot or create new
            for (const item of items) {
                const { data: existingLot } = await supabase
                    .from('inventory_lots')
                    .select('id, quantity')
                    .eq('product_id', item.product.id)
                    .eq('location_id', item.selected_location!.id)
                    .eq('lot_number', item.lot_number)
                    .maybeSingle();

                if (existingLot) {
                    await supabase
                        .from('inventory_lots')
                        .update({ quantity: existingLot.quantity + item.quantity })
                        .eq('id', existingLot.id);
                } else {
                    await supabase
                        .from('inventory_lots')
                        .insert({
                            product_id: item.product.id,
                            location_id: item.selected_location!.id,
                            lot_number: item.lot_number,
                            mfg_date: item.mfg_date || null,
                            exp_date: item.exp_date || null,
                            quantity: item.quantity
                        });
                }
            }

            toast.success("Inbound Complete", "Goods received and put away successfully!");
            router.push("/inventory/transactions");
        } catch (error: any) {
            const errMsg = error?.message || error?.details || error?.hint || JSON.stringify(error);
            console.error("Error saving inbound transactions:", error);
            toast.error("Save Failed", errMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter products for search
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5); // Show only top 5

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Progress Indicator */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <PackagePlus className="w-6 h-6 text-primary-600" />
                        Inbound Process
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Receive goods and prepare for putaway.</p>
                </div>

                <div className="flex items-center gap-2 text-sm font-medium">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${step === 1 ? 'bg-primary-100 text-primary-700' : 'text-gray-500'}`}>
                        <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${step === 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}>1</span>
                        Receiving
                    </div>
                    <div className="w-8 h-px bg-gray-300"></div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${step === 2 ? 'bg-primary-100 text-primary-700' : 'text-gray-500'}`}>
                        <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${step === 2 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}>2</span>
                        Putaway
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                {/* STEP 1: RECEIVING */}
                {step === 1 && (
                    <div className="p-6 md:p-8 space-y-8 animate-in slide-in-from-left-4 duration-300">

                        {/* Document Details Info */}
                        <div>
                            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 block"></span>
                                Document Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Reference Document (PO) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={referenceDoc}
                                        onChange={(e) => setReferenceDoc(e.target.value)}
                                        placeholder="e.g., PO-2026-001"
                                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all sm:text-sm bg-gray-50/50 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                                    <input
                                        type="text"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Optional tracking info or remarks"
                                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all sm:text-sm bg-gray-50/50 focus:bg-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-gray-100 w-full" />

                        {/* Received Items */}
                        <div>
                            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 block"></span>
                                Received Items
                            </h2>

                            {/* Search / Add Product */}
                            <div className="relative mb-6">
                                <Search className="absolute left-3.5 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search products by SKU or Name to add..."
                                    className="w-full rounded-xl border border-gray-200 pl-11 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all sm:text-sm"
                                />
                                {/* Search Results Dropdown */}
                                {searchQuery && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-10 max-h-60 overflow-y-auto">
                                        {filteredProducts.length > 0 ? (
                                            filteredProducts.map(product => (
                                                <button
                                                    key={product.id}
                                                    onClick={() => handleAddItem(product)}
                                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors"
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                                                        <p className="text-xs text-gray-500">{product.sku}</p>
                                                    </div>
                                                    <Plus className="w-4 h-4 text-primary-600" />
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-sm text-gray-500">No products found.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Items Table */}
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3">Product</th>
                                            <th className="px-4 py-3 w-24">Qty</th>
                                            <th className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <CalendarDays className="w-3.5 h-3.5" />
                                                    Lot / Batch Info
                                                </div>
                                            </th>
                                            <th className="px-4 py-3 w-14 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 bg-gray-50/50">
                                                    No items added yet. Search and add products above.
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 transition-colors align-top">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900">{item.product.name}</div>
                                                        <div className="text-xs text-gray-500 font-mono mt-0.5">{item.product.sku}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                                                            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-2">
                                                            <input
                                                                type="text"
                                                                value={item.lot_number}
                                                                onChange={(e) => handleUpdateLotField(item.product.id, 'lot_number', e.target.value)}
                                                                placeholder="Lot Number *"
                                                                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50/50 focus:bg-white"
                                                            />
                                                            <div className="flex gap-2">
                                                                <div className="flex-1">
                                                                    <label className="text-[10px] text-gray-400 font-medium uppercase">Mfg Date</label>
                                                                    <input
                                                                        type="date"
                                                                        value={item.mfg_date}
                                                                        onChange={(e) => handleUpdateLotField(item.product.id, 'mfg_date', e.target.value)}
                                                                        className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary-500"
                                                                    />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <label className="text-[10px] text-red-400 font-medium uppercase">Exp Date *</label>
                                                                    <input
                                                                        type="date"
                                                                        value={item.exp_date}
                                                                        onChange={(e) => handleUpdateLotField(item.product.id, 'exp_date', e.target.value)}
                                                                        className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleRemoveItem(item.product.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-block"
                                                            title="Remove Item"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-4 flex justify-end bg-white">
                            <button
                                onClick={handleNextStep}
                                className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                                disabled={items.length === 0 || !referenceDoc.trim()}
                            >
                                Next: Putaway
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}


                {/* STEP 2: PUTAWAY */}
                {step === 2 && (
                    <div className="p-6 md:p-8 space-y-8 animate-in slide-in-from-right-4 duration-300">

                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                            <div className="text-sm">
                                <p className="font-semibold mb-1">Smart Location Suggestion Active</p>
                                <p className="text-blue-700/80">The system has automatically suggested destination locations based on your product settings. You can review and modify them below.</p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 block"></span>
                                Assign Putaway Locations
                            </h2>

                            <div className="space-y-4">
                                {items.map((item, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50/30">
                                        <div className="flex-1 flex gap-4 items-center">
                                            <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-sm">
                                                <Package className="w-5 h-5 text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 leading-tight">{item.product.name}</p>
                                                <p className="text-xs text-gray-500 font-mono mt-1">SKU: {item.product.sku} <span className="mx-1">•</span> Qty: <span className="font-semibold text-gray-700">{item.quantity}</span></p>
                                            </div>
                                        </div>

                                        <div className="sm:w-64">
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <MapPin className={`w-4 h-4 ${item.suggested_location?.id === item.selected_location?.id ? 'text-green-500' : 'text-gray-400'}`} />
                                                </div>
                                                <select
                                                    value={item.selected_location?.id || ""}
                                                    onChange={(e) => handleUpdateLocation(item.product.id, e.target.value)}
                                                    className={`block w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none appearance-none bg-white transition-colors ${!item.selected_location ? 'border-red-300 ring-1 ring-red-100 bg-red-50' : 'border-gray-200'
                                                        }`}
                                                >
                                                    <option value="" disabled>Select Location...</option>
                                                    {locations.map(loc => (
                                                        <option key={loc.id} value={loc.id}>
                                                            {loc.bin_code} ({loc.zone_name})
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </div>
                                            {item.suggested_location?.id === item.selected_location?.id && (
                                                <p className="text-[10px] text-green-600 mt-1.5 font-medium ml-1 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Suggested Location
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-4 flex justify-between bg-white border-t border-gray-100 mt-6 pt-6">
                            <button
                                onClick={() => setStep(1)}
                                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Receiving
                            </button>

                            <button
                                onClick={handleConfirm}
                                disabled={isLoading}
                                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Confirm Inbound
                                        <CheckCircle2 className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
