"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Layers,
    Search,
    Loader2,
    AlertTriangle,
    XCircle,
    CheckCircle2,
    Package,
    MapPin,
    CalendarDays,
    Filter
} from "lucide-react";

// Types
type LotRow = {
    id: string;
    product_id: string;
    location_id: string;
    lot_number: string;
    mfg_date: string | null;
    exp_date: string | null;
    quantity: number;
    created_at: string;
    product: { sku: string; name: string } | null;
    location: { zone_name: string; bin_code: string } | null;
};

type ExpiryStatus = 'ALL' | 'EXPIRED' | 'NEAR_EXPIRY' | 'OK';

function getExpiryInfo(exp_date: string | null): { status: 'EXPIRED' | 'NEAR_EXPIRY' | 'OK' | 'UNKNOWN'; daysLeft: number | null; label: string; color: string; bgColor: string; borderColor: string } {
    if (!exp_date) return { status: 'UNKNOWN', daysLeft: null, label: 'No Expiry', color: 'text-gray-500', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expDate = new Date(exp_date);
    expDate.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) return { status: 'EXPIRED', daysLeft, label: 'Expired', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
    if (daysLeft <= 30) return { status: 'NEAR_EXPIRY', daysLeft, label: `${daysLeft}d left`, color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' };
    return { status: 'OK', daysLeft, label: `${daysLeft}d left`, color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' };
}

export default function LotsPage() {
    const supabase = createClient();
    const [lots, setLots] = useState<LotRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<ExpiryStatus>('ALL');

    useEffect(() => {
        fetchLots();
    }, []);

    const fetchLots = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('inventory_lots')
                .select(`
                    id, product_id, location_id, lot_number, mfg_date, exp_date, quantity, created_at,
                    product:products (sku, name),
                    location:locations (zone_name, bin_code)
                `)
                .gt('quantity', 0)
                .order('exp_date', { ascending: true });

            if (error) throw error;
            if (data) setLots(data as any[]);
        } catch (error) {
            console.error("Error fetching lots:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Computed: filtered lots
    const filteredLots = useMemo(() => {
        return lots.filter(lot => {
            // Search
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q ||
                lot.lot_number.toLowerCase().includes(q) ||
                lot.product?.name?.toLowerCase().includes(q) ||
                lot.product?.sku?.toLowerCase().includes(q);

            // Expiry status
            if (statusFilter === 'ALL') return matchesSearch;
            const info = getExpiryInfo(lot.exp_date);
            if (statusFilter === 'EXPIRED') return matchesSearch && info.status === 'EXPIRED';
            if (statusFilter === 'NEAR_EXPIRY') return matchesSearch && info.status === 'NEAR_EXPIRY';
            if (statusFilter === 'OK') return matchesSearch && (info.status === 'OK' || info.status === 'UNKNOWN');
            return matchesSearch;
        });
    }, [lots, searchQuery, statusFilter]);

    // Summary counts
    const summary = useMemo(() => {
        let expired = 0, nearExpiry = 0, ok = 0;
        lots.forEach(lot => {
            const info = getExpiryInfo(lot.exp_date);
            if (info.status === 'EXPIRED') expired++;
            else if (info.status === 'NEAR_EXPIRY') nearExpiry++;
            else ok++;
        });
        return { total: lots.length, expired, nearExpiry, ok };
    }, [lots]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <Layers className="w-6 h-6 text-primary-600" />
                    Lot Inventory
                </h1>
                <p className="text-gray-500 text-sm mt-1">Track stock at lot/batch level with expiry management (FEFO).</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Total Lots" value={summary.total} icon={<Layers className="w-5 h-5" />} color="bg-gray-50 text-gray-700 border-gray-200" />
                <SummaryCard label="Expired" value={summary.expired} icon={<XCircle className="w-5 h-5" />} color="bg-red-50 text-red-700 border-red-200" />
                <SummaryCard label="Expiring ≤30d" value={summary.nearExpiry} icon={<AlertTriangle className="w-5 h-5" />} color="bg-amber-50 text-amber-700 border-amber-200" />
                <SummaryCard label="OK" value={summary.ok} icon={<CheckCircle2 className="w-5 h-5" />} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by Product, SKU, or Lot Number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    {(['ALL', 'EXPIRED', 'NEAR_EXPIRY', 'OK'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${statusFilter === status
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {status === 'ALL' ? 'All' : status === 'NEAR_EXPIRY' ? '≤30 Days' : status === 'EXPIRED' ? 'Expired' : 'OK'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : filteredLots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
                        <Layers className="w-12 h-12 mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900">No Lots Found</h3>
                        <p className="mt-1 text-sm">No lot inventory matches your search criteria.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="px-5 py-4">Product</th>
                                    <th className="px-5 py-4">Location</th>
                                    <th className="px-5 py-4">Lot Number</th>
                                    <th className="px-5 py-4">Mfg Date</th>
                                    <th className="px-5 py-4">Exp Date</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4 text-right">Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredLots.map((lot) => {
                                    const expiry = getExpiryInfo(lot.exp_date);
                                    return (
                                        <tr key={lot.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                        <Package className="w-4 h-4 text-gray-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{lot.product?.name || '-'}</p>
                                                        <p className="text-xs text-gray-500 font-mono">{lot.product?.sku || '-'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2 text-gray-700">
                                                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="font-medium">{lot.location?.bin_code || '-'}</span>
                                                    <span className="text-xs text-gray-400">({lot.location?.zone_name})</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="font-mono font-medium text-gray-900 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                                    {lot.lot_number}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-gray-600">
                                                {lot.mfg_date ? new Date(lot.mfg_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                            </td>
                                            <td className="px-5 py-4 text-gray-600">
                                                {lot.exp_date ? new Date(lot.exp_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${expiry.bgColor} ${expiry.color} ${expiry.borderColor}`}>
                                                    {expiry.status === 'EXPIRED' && <XCircle className="w-3.5 h-3.5" />}
                                                    {expiry.status === 'NEAR_EXPIRY' && <AlertTriangle className="w-3.5 h-3.5" />}
                                                    {expiry.status === 'OK' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    {expiry.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="font-bold text-gray-900 text-base">{lot.quantity}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// Summary Card Component
function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
    return (
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${color} transition-all hover:shadow-sm`}>
            <div className="p-2.5 bg-white/60 rounded-lg shadow-sm">{icon}</div>
            <div>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-xs font-medium opacity-80 mt-0.5">{label}</p>
            </div>
        </div>
    );
}
