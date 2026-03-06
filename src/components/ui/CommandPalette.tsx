"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    Package,
    MapPin,
    LayoutDashboard,
    Settings,
    Activity,
    Plus,
    Search,
    Loader2
} from "lucide-react";

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    // Data states
    const [products, setProducts] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [dataFetched, setDataFetched] = useState(false);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    // Listen for custom event to open from anywhere
    useEffect(() => {
        const handleOpenCommandPalette = () => setOpen(true);
        window.addEventListener("open-command-palette", handleOpenCommandPalette);
        return () => window.removeEventListener("open-command-palette", handleOpenCommandPalette);
    }, []);

    // Fetch data when palette opens (only once)
    useEffect(() => {
        if (open && !dataFetched) {
            const fetchData = async () => {
                setIsLoading(true);
                const supabase = createClient();

                try {
                    const [
                        { data: productsData },
                        { data: locationsData },
                        { data: transactionsData }
                    ] = await Promise.all([
                        supabase.from('products').select('id, sku, name'),
                        supabase.from('locations').select('id, zone_name, bin_code'),
                        supabase.from('inventory_transactions').select(`
                            id, 
                            reference_doc, 
                            transaction_type, 
                            products(name), 
                            locations(bin_code)
                        `).order('created_at', { ascending: false }).limit(100)
                    ]);

                    if (productsData) setProducts(productsData);
                    if (locationsData) setLocations(locationsData);
                    if (transactionsData) setTransactions(transactionsData);

                    setDataFetched(true);
                } catch (error) {
                    console.error("Error fetching data for command palette:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [open, dataFetched]);

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
                onClick={() => setOpen(false)}
            />

            {/* Modal */}
            <Command
                className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                shouldFilter={true}
            >
                <div className="flex items-center border-b border-gray-100 px-4">
                    <Search className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
                    <Command.Input
                        autoFocus
                        placeholder="Type a command, search products, locations, or transactions..."
                        className="flex h-14 w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-400 text-gray-900"
                    />
                    {isLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />}
                </div>

                <Command.List className="max-h-[400px] overflow-y-auto p-2 scroll-smooth">
                    <Command.Empty className="py-6 text-center text-sm text-gray-500">
                        No results found.
                    </Command.Empty>

                    <Command.Group heading="Navigation" className="px-2 text-xs font-semibold text-gray-500 mb-2">
                        <Command.Item
                            onSelect={() => runCommand(() => router.push("/"))}
                            className="flex items-center gap-2 px-2 py-2.5 text-sm text-gray-700 rounded-md aria-selected:bg-primary-50 aria-selected:text-primary-700 cursor-pointer"
                        >
                            <LayoutDashboard className="w-4 h-4 mr-2" />
                            Dashboard
                        </Command.Item>
                        <Command.Item
                            onSelect={() => runCommand(() => router.push("/inventory/products"))}
                            className="flex items-center gap-2 px-2 py-2.5 text-sm text-gray-700 rounded-md aria-selected:bg-primary-50 aria-selected:text-primary-700 cursor-pointer"
                        >
                            <Package className="w-4 h-4 mr-2" />
                            Products Master
                        </Command.Item>
                        <Command.Item
                            onSelect={() => runCommand(() => router.push("/inventory/locations"))}
                            className="flex items-center gap-2 px-2 py-2.5 text-sm text-gray-700 rounded-md aria-selected:bg-primary-50 aria-selected:text-primary-700 cursor-pointer"
                        >
                            <MapPin className="w-4 h-4 mr-2" />
                            Locations
                        </Command.Item>
                        <Command.Item
                            onSelect={() => runCommand(() => router.push("/inventory/transactions"))}
                            className="flex items-center gap-2 px-2 py-2.5 text-sm text-gray-700 rounded-md aria-selected:bg-primary-50 aria-selected:text-primary-700 cursor-pointer"
                        >
                            <Activity className="w-4 h-4 mr-2" />
                            Transactions History
                        </Command.Item>
                    </Command.Group>

                    <Command.Separator className="h-px bg-gray-100 my-2" />

                    {/* Products Data */}
                    {products.length > 0 && (
                        <Command.Group heading="Products" className="px-2 text-xs font-semibold text-gray-500 mb-2">
                            {products.map(product => (
                                <Command.Item
                                    key={product.id}
                                    value={`product ${product.sku} ${product.name}`}
                                    onSelect={() => runCommand(() => router.push(`/inventory/products?search=${product.sku}`))}
                                    className="flex flex-col gap-0.5 px-3 py-2 text-sm text-gray-700 rounded-md aria-selected:bg-primary-50 aria-selected:text-primary-700 cursor-pointer"
                                >
                                    <div className="flex items-center font-medium">
                                        <Package className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                        {product.name}
                                    </div>
                                    <div className="text-xs text-gray-500 pl-5.5">SKU: {product.sku}</div>
                                </Command.Item>
                            ))}
                        </Command.Group>
                    )}

                    {/* Locations Data */}
                    {locations.length > 0 && (
                        <Command.Group heading="Locations" className="px-2 text-xs font-semibold text-gray-500 mb-2">
                            {locations.map(loc => (
                                <Command.Item
                                    key={loc.id}
                                    value={`location ${loc.bin_code} ${loc.zone_name}`}
                                    onSelect={() => runCommand(() => router.push(`/inventory/locations?search=${loc.bin_code}`))}
                                    className="flex flex-col gap-0.5 px-3 py-2 text-sm text-gray-700 rounded-md aria-selected:bg-primary-50 aria-selected:text-primary-700 cursor-pointer"
                                >
                                    <div className="flex items-center font-medium">
                                        <MapPin className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                        {loc.bin_code}
                                    </div>
                                    <div className="text-xs text-gray-500 pl-5.5">Zone: {loc.zone_name}</div>
                                </Command.Item>
                            ))}
                        </Command.Group>
                    )}

                    {/* Transactions Data */}
                    {transactions.length > 0 && (
                        <Command.Group heading="Recent Transactions" className="px-2 text-xs font-semibold text-gray-500 mb-2">
                            {transactions.map(tx => (
                                <Command.Item
                                    key={tx.id}
                                    value={`transaction ${tx.transaction_type} ${tx.reference_doc} ${tx.products?.name} ${tx.locations?.bin_code}`}
                                    onSelect={() => runCommand(() => router.push(`/inventory/transactions?search=${tx.reference_doc}`))}
                                    className="flex flex-col gap-0.5 px-3 py-2 text-sm text-gray-700 rounded-md aria-selected:bg-primary-50 aria-selected:text-primary-700 cursor-pointer"
                                >
                                    <div className="flex items-center font-medium">
                                        <Activity className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                        Ref: {tx.reference_doc || "No Ref"}
                                        <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                                            {tx.transaction_type}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 pl-5.5">
                                        {tx.products?.name} @ {tx.locations?.bin_code}
                                    </div>
                                </Command.Item>
                            ))}
                        </Command.Group>
                    )}

                    <Command.Separator className="h-px bg-gray-100 my-2" />

                    <Command.Group heading="Quick Actions" className="px-2 text-xs font-semibold text-gray-500 mb-2">
                        <Command.Item
                            onSelect={() => runCommand(() => router.push("/inventory/products?action=add"))}
                            className="flex items-center gap-2 px-2 py-2.5 text-sm text-gray-700 rounded-md aria-selected:bg-primary-50 aria-selected:text-primary-700 cursor-pointer"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add New Product...
                        </Command.Item>
                        <Command.Item
                            onSelect={() => runCommand(() => router.push("/inventory/locations?action=add"))}
                            className="flex items-center gap-2 px-2 py-2.5 text-sm text-gray-700 rounded-md aria-selected:bg-primary-50 aria-selected:text-primary-700 cursor-pointer"
                        >
                            <MapPin className="w-4 h-4 mr-2" />
                            Add New Location...
                        </Command.Item>
                    </Command.Group>

                    <Command.Separator className="h-px bg-gray-100 my-2" />

                    <Command.Group heading="Settings" className="px-2 text-xs font-semibold text-gray-500 mb-2">
                        <Command.Item
                            onSelect={() => runCommand(() => router.push("/settings"))}
                            className="flex items-center gap-2 px-2 py-2.5 text-sm text-gray-700 rounded-md aria-selected:bg-primary-50 aria-selected:text-primary-700 cursor-pointer"
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            System Settings
                        </Command.Item>
                    </Command.Group>
                </Command.List>

                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 sm:flex sm:items-center sm:justify-between hidden">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Use <kbd className="font-sans px-1.5 py-0.5 rounded-md bg-white border border-gray-200">↑</kbd> <kbd className="font-sans px-1.5 py-0.5 rounded-md bg-white border border-gray-200">↓</kbd> to navigate</span>
                        <span className="mx-1">•</span>
                        <span><kbd className="font-sans px-1.5 py-0.5 rounded-md bg-white border border-gray-200">Enter</kbd> to select</span>
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                        <kbd className="font-sans px-1.5 py-0.5 rounded-md bg-white border border-gray-200 mr-1">Esc</kbd> to close
                    </div>
                </div>
            </Command>
        </div>
    );
}
