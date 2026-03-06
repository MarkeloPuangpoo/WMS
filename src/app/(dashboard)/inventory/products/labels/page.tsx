"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Barcode from "react-barcode";
import { ArrowLeft, Printer, Box, Loader2, CheckSquare, Square } from "lucide-react";
import Link from "next/link";

type Product = {
    id: string;
    sku: string;
    name: string;
};

export default function ProductLabelsPage() {
    const supabase = createClient();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, sku, name')
                .order('sku');

            if (error) throw error;
            if (data) setProducts(data);
        } catch (error) {
            console.error("Error fetching products:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === products.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(products.map(p => p.id)));
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const selectedProducts = products.filter(p => selectedIds.has(p.id));

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">

            {/* NO-PRINT HEADER */}
            <div className="print:hidden space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/inventory/products" className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                                <Box className="w-6 h-6 text-primary-600" />
                                Product Labels
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">Select and print Barcode labels for physical items (SKUs).</p>
                        </div>
                    </div>

                    <button
                        onClick={handlePrint}
                        disabled={selectedIds.size === 0}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        Print Selected ({selectedIds.size})
                    </button>
                </div>

                {/* Selection UI */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Available Products</h3>
                        <button
                            onClick={toggleSelectAll}
                            className="text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                            {selectedIds.size === products.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="p-8 flex justify-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : (
                        <div className="max-h-64 overflow-y-auto p-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {products.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => toggleSelect(p.id)}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(p.id)
                                                ? 'bg-primary-50 border-primary-200 text-primary-900'
                                                : 'bg-white border-gray-200 hover:border-primary-300'
                                            }`}
                                    >
                                        {selectedIds.has(p.id) ? (
                                            <CheckSquare className="w-4 h-4 text-primary-600 shrink-0" />
                                        ) : (
                                            <Square className="w-4 h-4 text-gray-300 shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm truncate">{p.sku}</p>
                                            <p className="text-xs opacity-70 truncate">{p.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* PRINT OPTIMIZED AREA */}
            <div className="print:block hidden print:m-0 print:p-0">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page { size: portrait; margin: 0.5cm; }
                        body { background: white; }
                    }
                `}} />

                <div className="grid grid-cols-2 gap-4 print:gap-4 print:grid-cols-2">
                    {selectedProducts.map((p) => (
                        <div key={p.id} className="border-2 border-dashed border-gray-300 p-2 flex flex-col items-center justify-center text-center break-inside-avoid overflow-hidden" style={{ width: '100%', height: '2in' }}>
                            <div className="w-full text-xs font-semibold text-gray-800 truncate mb-2 px-2">
                                {p.name}
                            </div>

                            <div className="scale-75 md:scale-100 origin-top">
                                <Barcode
                                    value={p.sku}
                                    format="CODE128"
                                    width={2}
                                    height={50}
                                    displayValue={true}
                                    fontSize={16}
                                    margin={0}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Preview Area */}
            {selectedIds.size > 0 && (
                <div className="print:hidden">
                    <h3 className="font-semibold text-gray-900 mb-4 px-1">Print Preview</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80 pointer-events-none">
                        {selectedProducts.map((p) => (
                            <div key={`preview-${p.id}`} className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm h-40">
                                <div className="w-full text-sm font-semibold text-gray-800 truncate mb-3 px-2">
                                    {p.name}
                                </div>
                                <Barcode
                                    value={p.sku}
                                    format="CODE128"
                                    width={2}
                                    height={40}
                                    displayValue={true}
                                    fontSize={14}
                                    margin={0}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}
