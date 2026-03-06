"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Printer, MapPin, Loader2, CheckSquare, Square } from "lucide-react";
import Link from "next/link";

type Location = {
    id: string;
    zone_name: string;
    bin_code: string;
    description: string | null;
};

export default function LocationLabelsPage() {
    const supabase = createClient();
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('locations')
                .select('*')
                .order('zone_name')
                .order('bin_code');

            if (error) throw error;
            if (data) setLocations(data);
        } catch (error) {
            console.error("Error fetching locations:", error);
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
        if (selectedIds.size === locations.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(locations.map(loc => loc.id)));
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const selectedLocations = locations.filter(loc => selectedIds.has(loc.id));

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">

            {/* NO-PRINT HEADER: This section is hidden during window.print() */}
            <div className="print:hidden space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/inventory/locations" className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                                <MapPin className="w-6 h-6 text-primary-600" />
                                Location Labels
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">Select and print QR Code labels for warehouse bins.</p>
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
                        <h3 className="font-semibold text-gray-900">Available Locations</h3>
                        <button
                            onClick={toggleSelectAll}
                            className="text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                            {selectedIds.size === locations.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="p-8 flex justify-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : (
                        <div className="max-h-64 overflow-y-auto p-2">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                {locations.map(loc => (
                                    <div
                                        key={loc.id}
                                        onClick={() => toggleSelect(loc.id)}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(loc.id)
                                                ? 'bg-primary-50 border-primary-200 text-primary-900'
                                                : 'bg-white border-gray-200 hover:border-primary-300'
                                            }`}
                                    >
                                        {selectedIds.has(loc.id) ? (
                                            <CheckSquare className="w-4 h-4 text-primary-600 shrink-0" />
                                        ) : (
                                            <Square className="w-4 h-4 text-gray-300 shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm truncate">{loc.bin_code}</p>
                                            <p className="text-xs opacity-70 truncate">{loc.zone_name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* PRINT OPTIMIZED AREA: This section is the only thing visible in print mode */}
            <div className="print:block hidden print:m-0 print:p-0">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page { size: portrait; margin: 0.5cm; }
                        body { background: white; }
                        /* Ensure background colors on badges print correctly */
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                `}} />

                <div className="grid grid-cols-3 gap-4 print:gap-4 print:grid-cols-3">
                    {selectedLocations.map((loc) => (
                        <div key={loc.id} className="border-2 border-dashed border-gray-300 p-4 flex flex-col items-center justify-center text-center break-inside-avoid" style={{ width: '100%', height: '2in' }}>
                            <div className="font-bold text-2xl tracking-widest text-black mb-2">{loc.bin_code}</div>

                            <QRCodeSVG
                                value={loc.bin_code} // The data to scan
                                size={90}
                                level="M"
                                includeMargin={false}
                            />

                            <div className="mt-2 inline-block px-3 py-1 bg-gray-100 uppercase tracking-widest font-bold text-xs rounded-full">
                                {loc.zone_name}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Preview Area (Visible on screen to show what will be printed) */}
            {selectedIds.size > 0 && (
                <div className="print:hidden">
                    <h3 className="font-semibold text-gray-900 mb-4 px-1">Print Preview</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 opacity-70 pointer-events-none">
                        {selectedLocations.map((loc) => (
                            <div key={`preview-${loc.id}`} className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
                                <div className="font-bold text-xl tracking-widest text-black mb-3">{loc.bin_code}</div>
                                <QRCodeSVG value={loc.bin_code} size={100} level="M" />
                                <div className="mt-3 px-3 py-1 bg-gray-100 text-gray-600 uppercase tracking-widest font-bold text-xs rounded-full">
                                    {loc.zone_name}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}
