"use client";

import { useState, useEffect, useMemo } from "react";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    ArrowRightLeft,
    SlidersHorizontal,
    Search,
    FileText,
    TrendingUp,
    TrendingDown,
    Activity,
    Calendar,
    Filter,
    ChevronDown,
    RotateCcw,
    Package,
    Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TransactionType = "INBOUND" | "OUTBOUND" | "TRANSFER" | "ADJUSTMENT";

type Transaction = {
    id: string;
    transaction_type: TransactionType;
    product_id: string;
    location_id: string;
    quantity: number;
    reference_doc: string | null;
    notes: string | null;
    created_by: string;
    created_at: string;
    products?: { sku: string; name: string };
    locations?: { bin_code: string; zone_name: string };
    user_profiles?: { full_name: string };
};

const TYPE_CONFIG: Record<
    TransactionType,
    { label: string; icon: typeof ArrowDownCircle; color: string; bg: string; ring: string; gradient: string }
> = {
    INBOUND: {
        label: "Inbound",
        icon: ArrowDownCircle,
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        ring: "ring-emerald-600/20",
        gradient: "from-emerald-500 to-emerald-600",
    },
    OUTBOUND: {
        label: "Outbound",
        icon: ArrowUpCircle,
        color: "text-rose-700",
        bg: "bg-rose-50",
        ring: "ring-rose-600/20",
        gradient: "from-rose-500 to-rose-600",
    },
    TRANSFER: {
        label: "Transfer",
        icon: ArrowRightLeft,
        color: "text-sky-700",
        bg: "bg-sky-50",
        ring: "ring-sky-600/20",
        gradient: "from-sky-500 to-sky-600",
    },
    ADJUSTMENT: {
        label: "Adjustment",
        icon: SlidersHorizontal,
        color: "text-amber-700",
        bg: "bg-amber-50",
        ring: "ring-amber-600/20",
        gradient: "from-amber-500 to-amber-600",
    },
};

function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function timeAgo(dateStr: string) {
    const now = new Date();
    const then = new Date(dateStr);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export default function TransactionsPage() {
    const supabase = createClient();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<TransactionType | "ALL">("ALL");
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from("inventory_transactions")
            .select(
                `
                *,
                products ( sku, name ),
                locations ( bin_code, zone_name ),
                user_profiles:created_by ( full_name )
            `
            )
            .order("created_at", { ascending: false });

        if (data) setTransactions(data);
        if (error) console.error("Error fetching transactions:", error);
        setIsLoading(false);
    };

    // Computed stats
    const stats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let totalIn = 0;
        let totalOut = 0;
        let todayCount = 0;

        transactions.forEach((t) => {
            if (t.quantity > 0) totalIn += t.quantity;
            if (t.quantity < 0) totalOut += Math.abs(t.quantity);
            if (new Date(t.created_at) >= today) todayCount++;
        });

        return {
            total: transactions.length,
            totalIn,
            totalOut,
            todayCount,
        };
    }, [transactions]);

    // Filtered transactions
    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            const matchesType =
                typeFilter === "ALL" || t.transaction_type === typeFilter;
            const matchesSearch =
                searchQuery === "" ||
                t.reference_doc
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                t.products?.name
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                t.products?.sku
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                t.notes?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesType && matchesSearch;
        });
    }, [transactions, typeFilter, searchQuery]);

    const statCards = [
        {
            name: "Total Transactions",
            value: stats.total,
            icon: Activity,
            color: "text-primary-600",
            bg: "bg-primary-50",
            gradient: "from-primary-500 to-primary-600",
        },
        {
            name: "Units Received",
            value: stats.totalIn.toLocaleString(),
            icon: TrendingUp,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            gradient: "from-emerald-500 to-emerald-600",
        },
        {
            name: "Units Dispatched",
            value: stats.totalOut.toLocaleString(),
            icon: TrendingDown,
            color: "text-rose-600",
            bg: "bg-rose-50",
            gradient: "from-rose-500 to-rose-600",
        },
        {
            name: "Today's Activity",
            value: stats.todayCount,
            icon: Calendar,
            color: "text-sky-600",
            bg: "bg-sky-50",
            gradient: "from-sky-500 to-sky-600",
        },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Activity className="h-6 w-6 text-primary-600" />
                        Inventory Transactions
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Complete history of all stock movements in your
                        warehouse.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0">
                    <button
                        onClick={fetchTransactions}
                        className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border-light hover:bg-surface-hover transition-all duration-200 active:scale-[0.97]"
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => (
                    <div
                        key={stat.name}
                        className="group relative overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-border-light hover:shadow-md transition-all duration-300"
                    >
                        {/* Gradient accent bar */}
                        <div
                            className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient} opacity-80`}
                        />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">
                                    {stat.name}
                                </p>
                                <p className="mt-2 text-3xl font-bold text-foreground tracking-tight">
                                    {stat.value}
                                </p>
                            </div>
                            <div
                                className={`rounded-xl p-3 ${stat.bg} group-hover:scale-110 transition-transform duration-300`}
                            >
                                <stat.icon
                                    className={`h-6 w-6 ${stat.color}`}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Table Card */}
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-border-light overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-border-light">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Search
                                    className="h-4 w-4 text-gray-400"
                                    aria-hidden="true"
                                />
                            </div>
                            <input
                                type="text"
                                className="block w-full rounded-lg border-0 py-2.5 pl-10 pr-3 text-foreground ring-1 ring-inset ring-border-light placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm transition-all"
                                placeholder="Search by product, SKU, or reference..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Filter Toggle */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ring-1 ${showFilters || typeFilter !== "ALL"
                                    ? "bg-primary-50 text-primary-700 ring-primary-600/20"
                                    : "bg-surface text-foreground ring-border-light hover:bg-surface-hover"
                                }`}
                        >
                            <Filter className="h-4 w-4" />
                            Filters
                            {typeFilter !== "ALL" && (
                                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-bold">
                                    1
                                </span>
                            )}
                            <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform duration-200 ${showFilters ? "rotate-180" : ""
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Filter Panel */}
                    {showFilters && (
                        <div className="mt-4 pt-4 border-t border-border-light animate-in slide-in-from-top-2 duration-200">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                Transaction Type
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setTypeFilter("ALL")}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ring-1 ${typeFilter === "ALL"
                                            ? "bg-foreground text-white ring-foreground"
                                            : "bg-surface text-foreground ring-border-light hover:bg-surface-hover"
                                        }`}
                                >
                                    All Types
                                </button>
                                {(
                                    Object.keys(
                                        TYPE_CONFIG
                                    ) as TransactionType[]
                                ).map((type) => {
                                    const config = TYPE_CONFIG[type];
                                    const Icon = config.icon;
                                    return (
                                        <button
                                            key={type}
                                            onClick={() =>
                                                setTypeFilter(type)
                                            }
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ring-1 ${typeFilter === type
                                                    ? `${config.bg} ${config.color} ${config.ring}`
                                                    : "bg-surface text-foreground ring-border-light hover:bg-surface-hover"
                                                }`}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            {config.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Info */}
                <div className="px-4 py-2.5 bg-surface/50 border-b border-border-light">
                    <p className="text-xs font-medium text-gray-500">
                        Showing{" "}
                        <span className="text-foreground font-semibold">
                            {filteredTransactions.length}
                        </span>{" "}
                        of{" "}
                        <span className="text-foreground font-semibold">
                            {transactions.length}
                        </span>{" "}
                        transactions
                    </p>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border-light">
                        <thead className="bg-surface">
                            <tr>
                                <th
                                    scope="col"
                                    className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sm:pl-6"
                                >
                                    Type
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                                >
                                    Product
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                                >
                                    Location
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider"
                                >
                                    Quantity
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                                >
                                    Reference
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                                >
                                    By
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider sm:pr-6"
                                >
                                    Date
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light bg-white">
                            {isLoading ? (
                                // Skeleton loading
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: 7 }).map(
                                            (_, j) => (
                                                <td
                                                    key={j}
                                                    className="px-3 py-4 sm:first:pl-6 sm:last:pr-6"
                                                >
                                                    <div className="h-4 bg-gray-100 rounded-md animate-pulse" />
                                                </td>
                                            )
                                        )}
                                    </tr>
                                ))
                            ) : filteredTransactions.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="py-16 text-center"
                                    >
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mb-4">
                                                <FileText className="h-8 w-8 text-gray-300" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-foreground">
                                                No transactions found
                                            </h3>
                                            <p className="mt-1 text-sm text-gray-500 max-w-sm">
                                                {searchQuery ||
                                                    typeFilter !== "ALL"
                                                    ? "Try adjusting your search or filter criteria."
                                                    : "Stock movements will appear here once transactions are recorded."}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((txn, index) => {
                                    const config =
                                        TYPE_CONFIG[txn.transaction_type];
                                    const Icon = config.icon;
                                    const isPositive = txn.quantity > 0;

                                    return (
                                        <tr
                                            key={txn.id}
                                            className="hover:bg-surface-hover/50 transition-colors duration-150"
                                            style={{
                                                animationDelay: `${index * 30}ms`,
                                            }}
                                        >
                                            {/* Type */}
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${config.bg} ${config.color} ring-1 ${config.ring}`}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                    {config.label}
                                                </span>
                                            </td>

                                            {/* Product */}
                                            <td className="px-3 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                                                        <Package className="h-4 w-4 text-primary-600" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-foreground truncate">
                                                            {txn.products
                                                                ?.name ||
                                                                "Unknown"}
                                                        </p>
                                                        <p className="text-xs text-gray-400 font-mono">
                                                            {txn.products
                                                                ?.sku ||
                                                                "—"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Location */}
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                <div>
                                                    <p className="font-medium text-foreground">
                                                        {txn.locations
                                                            ?.bin_code ||
                                                            "—"}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {txn.locations
                                                            ?.zone_name ||
                                                            ""}
                                                    </p>
                                                </div>
                                            </td>

                                            {/* Quantity */}
                                            <td className="whitespace-nowrap px-3 py-4 text-right">
                                                <span
                                                    className={`inline-flex items-center gap-1 text-sm font-bold tracking-tight ${isPositive
                                                            ? "text-emerald-600"
                                                            : "text-rose-600"
                                                        }`}
                                                >
                                                    {isPositive
                                                        ? "+"
                                                        : ""}
                                                    {txn.quantity.toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Reference */}
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                {txn.reference_doc ? (
                                                    <span className="inline-flex items-center gap-1.5 text-foreground">
                                                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                                                        <span className="font-mono text-xs">
                                                            {
                                                                txn.reference_doc
                                                            }
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">
                                                        —
                                                    </span>
                                                )}
                                            </td>

                                            {/* Created By */}
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600">
                                                        {txn.user_profiles
                                                            ?.full_name?.[0]
                                                            ?.toUpperCase() ||
                                                            "?"}
                                                    </div>
                                                    <span className="text-gray-600 text-sm">
                                                        {txn.user_profiles
                                                            ?.full_name ||
                                                            "Unknown"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Date */}
                                            <td className="whitespace-nowrap px-3 py-4 text-right sm:pr-6">
                                                <div>
                                                    <p className="text-sm text-foreground font-medium">
                                                        {formatDate(
                                                            txn.created_at
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-gray-400 flex items-center justify-end gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {formatTime(
                                                            txn.created_at
                                                        )}
                                                        <span className="text-gray-300 mx-0.5">
                                                            ·
                                                        </span>
                                                        {timeAgo(
                                                            txn.created_at
                                                        )}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
