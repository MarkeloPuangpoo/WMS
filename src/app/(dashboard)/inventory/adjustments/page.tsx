"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import {
    SlidersHorizontal,
    Plus,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    Package,
    MapPin,
    ChevronDown,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Search,
    X
} from "lucide-react";

type Product = { id: string; sku: string; name: string };
type Location = { id: string; bin_code: string; zone_name: string };

type AdjRequest = {
    id: string;
    product_id: string;
    location_id: string;
    quantity_change: number;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    requested_by: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
    products?: { sku: string; name: string };
    locations?: { bin_code: string; zone_name: string };
    requester?: { full_name: string };
    reviewer?: { full_name: string };
};

const STATUS_CONFIG = {
    PENDING: { label: 'Pending', icon: Clock, bg: 'bg-amber-50', color: 'text-amber-700', border: 'border-amber-200' },
    APPROVED: { label: 'Approved', icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-700', border: 'border-emerald-200' },
    REJECTED: { label: 'Rejected', icon: XCircle, bg: 'bg-red-50', color: 'text-red-700', border: 'border-red-200' },
};

export default function AdjustmentsPage() {
    const supabase = createClient();
    const toast = useToast();

    const [requests, setRequests] = useState<AdjRequest[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userRole, setUserRole] = useState("");
    const [userId, setUserId] = useState("");
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [searchQuery, setSearchQuery] = useState("");

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({
        product_id: "",
        location_id: "",
        quantity_change: 0,
        reason: "",
    });

    useEffect(() => { init(); }, []);

    const init = async () => {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
        setUserRole(profile?.role || 'user');

        await Promise.all([fetchRequests(), fetchProducts(), fetchLocations()]);
        setIsLoading(false);
    };

    const fetchRequests = async () => {
        const { data } = await supabase
            .from('adjustment_requests')
            .select(`
                *,
                products (sku, name),
                locations (bin_code, zone_name),
                requester:user_profiles!adjustment_requests_requested_by_fkey (full_name),
                reviewer:user_profiles!adjustment_requests_reviewed_by_fkey (full_name)
            `)
            .order('created_at', { ascending: false });
        if (data) setRequests(data as any[]);
    };

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('id, sku, name').order('name');
        if (data) setProducts(data);
    };

    const fetchLocations = async () => {
        const { data } = await supabase.from('locations').select('id, bin_code, zone_name').order('bin_code');
        if (data) setLocations(data);
    };

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.product_id || !form.location_id || form.quantity_change === 0 || !form.reason.trim()) {
            toast.warning("Incomplete", "Please fill all fields and set a non-zero quantity change.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('adjustment_requests').insert({
                product_id: form.product_id,
                location_id: form.location_id,
                quantity_change: form.quantity_change,
                reason: form.reason,
                requested_by: userId,
            });
            if (error) throw error;

            toast.success("Request Submitted", "Your adjustment request is pending manager approval.");
            setShowModal(false);
            setForm({ product_id: "", location_id: "", quantity_change: 0, reason: "" });
            fetchRequests();
        } catch (err: any) {
            toast.error("Submit Failed", err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReview = async (requestId: string, action: 'APPROVED' | 'REJECTED', request: AdjRequest) => {
        try {
            // Update request status
            const { error: updateError } = await supabase
                .from('adjustment_requests')
                .update({
                    status: action,
                    reviewed_by: userId,
                    reviewed_at: new Date().toISOString(),
                })
                .eq('id', requestId);

            if (updateError) throw updateError;

            // If approved, apply the adjustment
            if (action === 'APPROVED') {
                // Create inventory transaction
                const { error: txError } = await supabase
                    .from('inventory_transactions')
                    .insert({
                        transaction_type: 'ADJUSTMENT',
                        product_id: request.product_id,
                        location_id: request.location_id,
                        quantity: request.quantity_change,
                        reference_doc: `ADJ-${requestId.slice(0, 8).toUpperCase()}`,
                        notes: `Approved adjustment: ${request.reason}`,
                        created_by: userId,
                    });
                if (txError) throw txError;

                // Update product quantity
                const { data: product } = await supabase
                    .from('products')
                    .select('quantity')
                    .eq('id', request.product_id)
                    .single();

                if (product) {
                    await supabase
                        .from('products')
                        .update({ quantity: product.quantity + request.quantity_change })
                        .eq('id', request.product_id);
                }

                toast.success("Approved", "Adjustment applied and inventory updated.");
            } else {
                toast.info("Rejected", "The adjustment request has been rejected.");
            }

            fetchRequests();
        } catch (err: any) {
            toast.error("Review Failed", err.message);
        }
    };

    const isManager = userRole === 'superadmin' || userRole === 'sup';

    const filteredRequests = useMemo(() => {
        return requests.filter(r => {
            const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q ||
                r.products?.name?.toLowerCase().includes(q) ||
                r.products?.sku?.toLowerCase().includes(q) ||
                r.reason.toLowerCase().includes(q) ||
                r.requester?.full_name?.toLowerCase().includes(q);
            return matchesStatus && matchesSearch;
        });
    }, [requests, statusFilter, searchQuery]);

    const pendingCount = requests.filter(r => r.status === 'PENDING').length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <SlidersHorizontal className="w-6 h-6 text-primary-600" />
                        Stock Adjustments
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Request and manage inventory quantity adjustments with manager approval.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-primary-700 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                >
                    <Plus className="w-4 h-4" />
                    New Request
                </button>
            </div>

            {/* Pending Alert for Managers */}
            {isManager && pendingCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-center">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="text-sm">
                        <span className="font-semibold text-amber-800">{pendingCount} pending request{pendingCount > 1 ? 's' : ''}</span>
                        <span className="text-amber-700"> awaiting your approval.</span>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by product, reason, or requester..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${statusFilter === s
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {s === 'ALL' ? 'All' : STATUS_CONFIG[s].label}
                            {s === 'PENDING' && pendingCount > 0 && (
                                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-[10px] font-bold text-amber-900">
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Request List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
                        <SlidersHorizontal className="w-12 h-12 mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900">No Adjustment Requests</h3>
                        <p className="mt-1 text-sm">Click "New Request" to create one.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredRequests.map(req => {
                            const cfg = STATUS_CONFIG[req.status];
                            const Icon = cfg.icon;
                            const isPositive = req.quantity_change > 0;

                            return (
                                <div key={req.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                                    <Icon className="w-3.5 h-3.5" />
                                                    {cfg.label}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 text-sm font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                                    {isPositive ? '+' : ''}{req.quantity_change}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                                <span className="flex items-center gap-1.5 text-gray-900 font-medium">
                                                    <Package className="w-3.5 h-3.5 text-gray-400" />
                                                    {req.products?.name || 'Unknown'}
                                                    <span className="text-gray-400 font-mono text-xs">({req.products?.sku})</span>
                                                </span>
                                                <span className="flex items-center gap-1.5 text-gray-500">
                                                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                    {req.locations?.bin_code || 'Unknown'}
                                                </span>
                                            </div>

                                            <p className="text-sm text-gray-600 mt-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                                                <span className="font-medium text-gray-500">Reason: </span>{req.reason}
                                            </p>

                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                                <span>By: <span className="font-medium text-gray-500">{req.requester?.full_name || 'Unknown'}</span></span>
                                                <span>{new Date(req.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                {req.reviewer && (
                                                    <span>Reviewed by: <span className="font-medium text-gray-500">{req.reviewer.full_name}</span></span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Approve/Reject Buttons */}
                                        {isManager && req.status === 'PENDING' && (
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleReview(req.id, 'APPROVED', req)}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-all active:scale-[0.97]"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleReview(req.id, 'REJECTED', req)}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-red-600 rounded-lg text-xs font-semibold border border-red-200 hover:bg-red-50 transition-all active:scale-[0.97]"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Request Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900">New Adjustment Request</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitRequest} className="px-6 py-5 space-y-5">
                            {/* Product */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product <span className="text-red-500">*</span></label>
                                <select
                                    value={form.product_id}
                                    onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                                    required
                                    className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-primary-600 text-sm bg-white"
                                >
                                    <option value="">-- Select Product --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location <span className="text-red-500">*</span></label>
                                <select
                                    value={form.location_id}
                                    onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                                    required
                                    className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-primary-600 text-sm bg-white"
                                >
                                    <option value="">-- Select Location --</option>
                                    {locations.map(l => (
                                        <option key={l.id} value={l.id}>{l.zone_name} / {l.bin_code}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Quantity Change */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Quantity Change <span className="text-red-500">*</span>
                                    <span className="text-xs font-normal text-gray-400 ml-2">(positive = add, negative = deduct)</span>
                                </label>
                                <input
                                    type="number"
                                    value={form.quantity_change}
                                    onChange={(e) => setForm({ ...form, quantity_change: parseInt(e.target.value) || 0 })}
                                    required
                                    className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-primary-600 text-sm"
                                    placeholder="e.g. -5 or +10"
                                />
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason <span className="text-red-500">*</span></label>
                                <textarea
                                    value={form.reason}
                                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                    required
                                    rows={3}
                                    className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-primary-600 text-sm resize-none"
                                    placeholder="Why is this adjustment needed? e.g. Damaged goods, Cycle count discrepancy..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white rounded-lg ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-all flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                                    ) : (
                                        'Submit Request'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
