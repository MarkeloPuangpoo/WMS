"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Package, Filter, X, Loader2, PackageSearch, Barcode } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

type Product = {
    id: string;
    sku: string;
    name: string;
    description: string;
    quantity: number;
    min_stock_level: number;
    location_id?: string;
};

type Location = {
    id: string;
    bin_code: string;
    zone_name: string;
}

export default function ProductsPage() {
    const supabase = createClient();
    const toast = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);

    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // RBAC
    const [userRole, setUserRole] = useState<string>("user");

    useEffect(() => {
        fetchData();
        checkUserRole();
    }, []);

    const checkUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
            if (data) setUserRole(data.role);
        }
    };

    const fetchData = async () => {
        setIsLoading(true);
        // Fetch Products
        const { data: prodData } = await supabase
            .from('products')
            .select('*')
            .order('name', { ascending: true });

        if (prodData) setProducts(prodData);

        // Fetch Locations for dropdown
        const { data: locData } = await supabase
            .from('locations')
            .select('id, bin_code, zone_name')
            .order('zone_name')
            .order('bin_code');

        if (locData) setLocations(locData);

        setIsLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const payload = {
            sku: currentProduct.sku,
            name: currentProduct.name,
            description: currentProduct.description || null,
            quantity: currentProduct.quantity || 0,
            min_stock_level: currentProduct.min_stock_level || 10,
            location_id: currentProduct.location_id || null
        };

        try {
            if (modalMode === 'add') {
                const { error } = await supabase.from('products').insert([payload]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('products').update(payload).eq('id', currentProduct.id);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchData();
        } catch (error: any) {
            toast.error("Save Failed", error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}?`)) return;

        try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (error: any) {
            toast.error("Delete Failed", error.message);
        }
    };

    const openModal = (mode: 'add' | 'edit', product?: Product) => {
        setModalMode(mode);
        setCurrentProduct(product || { sku: '', name: '', description: '', quantity: 0, min_stock_level: 10, location_id: '' });
        setIsModalOpen(true);
    };

    const filteredProducts = products.filter((product) => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.sku.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLowStock = showLowStockOnly ? product.quantity <= product.min_stock_level : true;
        return matchesSearch && matchesLowStock;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
                        <div className="p-2 bg-primary-50 rounded-lg">
                            <Package className="h-6 w-6 text-primary-600" />
                        </div>
                        Product Master
                    </h1>
                    <p className="mt-1.5 text-sm text-gray-500">
                        Manage your inventory items, SKUs, and monitor stock levels.
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                    <Link
                        href="/inventory/products/labels"
                        className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50 transition-all focus:ring-2 focus:ring-gray-200 focus:ring-offset-2"
                    >
                        <Barcode className="-ml-1 mr-2 h-5 w-5 text-gray-400" aria-hidden="true" />
                        Print Barcodes
                    </Link>
                    {(userRole === 'superadmin' || userRole === 'sup') && (
                        <button
                            type="button"
                            onClick={() => openModal('add')}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-all focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                        >
                            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            Add Product
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Toolbar */}
                <div className="p-5 border-b border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative max-w-md w-full">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all"
                            placeholder="Search by Name or SKU..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 border ${showLowStockOnly
                            ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                    >
                        <Filter className={`h-4 w-4 ${showLowStockOnly ? "text-red-500" : "text-gray-400"}`} />
                        Low Stock Only
                    </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th scope="col" className="py-4 pl-6 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    SKU
                                </th>
                                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Product Name
                                </th>
                                <th scope="col" className="px-3 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Qty
                                </th>
                                <th scope="col" className="px-3 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Min Stock
                                </th>
                                <th scope="col" className="px-3 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                {(userRole === 'superadmin' || userRole === 'sup') && (
                                    <th scope="col" className="relative py-4 pl-3 pr-6 text-right">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <Loader2 className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-3" />
                                        <p className="text-sm text-gray-500 font-medium">Loading products...</p>
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                            <PackageSearch className="h-8 w-8 text-gray-400" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-gray-900">No products found</h3>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {searchQuery || showLowStockOnly
                                                ? "Try adjusting your search query or filters."
                                                : "Get started by adding your first product."}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => {
                                    const isLowStock = product.quantity <= product.min_stock_level;
                                    return (
                                        <tr key={product.id} className="hover:bg-gray-50/80 transition-colors group">
                                            <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium">
                                                <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-200">
                                                    {product.sku}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-sm">
                                                <div className="font-semibold text-gray-900">{product.name}</div>
                                                <div className="text-xs text-gray-500 truncate max-w-[200px] mt-0.5">
                                                    {product.description || <span className="italic text-gray-300">No description</span>}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-bold text-gray-900">
                                                {product.quantity}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-400 font-medium">
                                                {product.min_stock_level}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                                                {isLowStock ? (
                                                    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 border border-red-200">
                                                        Low Stock
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 border border-green-200">
                                                        In Stock
                                                    </span>
                                                )}
                                            </td>
                                            {(userRole === 'superadmin' || userRole === 'sup') && (
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openModal('edit', product)}
                                                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        {userRole === 'superadmin' && (
                                                            <button
                                                                onClick={() => handleDelete(product.id, product.name)}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />
                    <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:w-full sm:max-w-xl">
                        <div className="bg-white px-6 pb-6 pt-6">
                            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                                <h3 className="text-lg font-bold text-gray-900">
                                    {modalMode === 'add' ? 'Add New Product' : 'Edit Product'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-1.5 rounded-full transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSave}>
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label htmlFor="sku" className="block text-sm font-semibold text-gray-700">SKU <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                id="sku"
                                                required
                                                className="mt-1.5 block w-full rounded-lg border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all"
                                                placeholder="e.g. PRD-001"
                                                value={currentProduct.sku || ''}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, sku: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="name" className="block text-sm font-semibold text-gray-700">Product Name <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                id="name"
                                                required
                                                className="mt-1.5 block w-full rounded-lg border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all"
                                                placeholder="e.g. Mechanical Keyboard"
                                                value={currentProduct.name || ''}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="description" className="block text-sm font-semibold text-gray-700">Description</label>
                                        <textarea
                                            id="description"
                                            rows={2}
                                            className="mt-1.5 block w-full rounded-lg border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all resize-none"
                                            placeholder="Optional details about this product..."
                                            value={currentProduct.description || ''}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700">Current Quantity</label>
                                            <input
                                                type="number"
                                                id="quantity"
                                                min="0"
                                                className="mt-1.5 block w-full rounded-lg border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all"
                                                value={currentProduct.quantity || 0}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, quantity: parseInt(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="min_stock_level" className="block text-sm font-semibold text-gray-700">Min Stock Level</label>
                                            <input
                                                type="number"
                                                id="min_stock_level"
                                                min="0"
                                                className="mt-1.5 block w-full rounded-lg border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all"
                                                value={currentProduct.min_stock_level || 0}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, min_stock_level: parseInt(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="location_id" className="block text-sm font-semibold text-gray-700">Default Location</label>
                                        <select
                                            id="location_id"
                                            className="mt-1.5 block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all bg-white"
                                            value={currentProduct.location_id || ''}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, location_id: e.target.value })}
                                        >
                                            <option value="">-- No Default Location --</option>
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>
                                                    {loc.zone_name} / {loc.bin_code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-50">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="inline-flex w-full justify-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 sm:w-auto transition-colors"
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                                            </span>
                                        ) : (
                                            'Save Product'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}