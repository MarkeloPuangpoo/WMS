"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Package, Filter, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
            alert(`Error saving product: ${error.message}`);
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
            alert(`Error deleting product: ${error.message}`);
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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Package className="h-6 w-6 text-primary-600" />
                        Product Master
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage your inventory items, SKUs, and stock levels.
                    </p>
                </div>
                {(userRole === 'superadmin' || userRole === 'sup') && (
                    <div className="mt-4 sm:ml-4 sm:mt-0">
                        <button
                            type="button"
                            onClick={() => openModal('add')}
                            className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 transition-colors"
                        >
                            <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                            Add New Product
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm ring-1 ring-border-light overflow-hidden">
                <div className="p-4 border-b border-border-light flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative rounded-md shadow-sm max-w-sm w-full">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-md border-0 py-2 pl-10 text-foreground ring-1 ring-inset ring-border-light placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition-all"
                            placeholder="Search by Name or SKU..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ring-1 ${showLowStockOnly
                            ? "bg-red-50 text-red-700 ring-red-600/20"
                            : "bg-surface text-foreground ring-border-light hover:bg-surface-hover"
                            }`}
                    >
                        <Filter className="h-4 w-4" />
                        Low Stock Only
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border-light">
                        <thead className="bg-surface">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">
                                    SKU
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                                    Product Name
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">
                                    Qty
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">
                                    Min Stock
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-foreground">
                                    Status
                                </th>
                                {(userRole === 'superadmin' || userRole === 'sup') && (
                                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-sm text-gray-500">
                                        Loading products...
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-sm text-gray-500">
                                        No products found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => {
                                    const isLowStock = product.quantity <= product.min_stock_level;
                                    return (
                                        <tr key={product.id} className="hover:bg-surface-hover transition-colors">
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                                                <span className="inline-flex items-center rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 ring-1 ring-inset ring-primary-600/20">
                                                    {product.sku}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-gray-500">
                                                <div className="font-medium text-foreground">{product.name}</div>
                                                <div className="text-xs text-gray-400 truncate max-w-xs">{product.description || "-"}</div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-semibold text-foreground">
                                                {product.quantity}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                                                {product.min_stock_level}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                                                {isLowStock ? (
                                                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                                                        Low Stock
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                                        In Stock
                                                    </span>
                                                )}
                                            </td>
                                            {(userRole === 'superadmin' || userRole === 'sup') && (
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                    <button
                                                        onClick={() => openModal('edit', product)}
                                                        className="text-primary-600 hover:text-primary-900 mr-4 transition-colors"
                                                    >
                                                        <Edit2 className="h-4 w-4 inline" />
                                                    </button>
                                                    {userRole === 'superadmin' && (
                                                        <button
                                                            onClick={() => handleDelete(product.id, product.name)}
                                                            className="text-red-600 hover:text-red-900 transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4 inline" />
                                                        </button>
                                                    )}
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
                    <div className="fixed inset-0 bg-gray-900/50 transition-opacity" onClick={() => setIsModalOpen(false)} />
                    <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:w-full sm:max-w-lg">
                        <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-semibold leading-6 text-foreground">
                                    {modalMode === 'add' ? 'Add New Product' : 'Edit Product'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSave}>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="sku" className="block text-sm font-medium leading-6 text-foreground">SKU *</label>
                                            <input
                                                type="text"
                                                id="sku"
                                                required
                                                className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border-light focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                                                value={currentProduct.sku || ''}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, sku: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="name" className="block text-sm font-medium leading-6 text-foreground">Product Name *</label>
                                            <input
                                                type="text"
                                                id="name"
                                                required
                                                className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border-light focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                                                value={currentProduct.name || ''}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="description" className="block text-sm font-medium leading-6 text-foreground">Description</label>
                                        <input
                                            type="text"
                                            id="description"
                                            className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border-light focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                                            value={currentProduct.description || ''}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="quantity" className="block text-sm font-medium leading-6 text-foreground">Quantity</label>
                                            <input
                                                type="number"
                                                id="quantity"
                                                className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border-light focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                                                value={currentProduct.quantity || 0}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, quantity: parseInt(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="min_stock_level" className="block text-sm font-medium leading-6 text-foreground">Min Stock Level</label>
                                            <input
                                                type="number"
                                                id="min_stock_level"
                                                className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border-light focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                                                value={currentProduct.min_stock_level || 0}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, min_stock_level: parseInt(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="location_id" className="block text-sm font-medium leading-6 text-foreground">Default Location (Optional)</label>
                                        <select
                                            id="location_id"
                                            className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border-light focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                                            value={currentProduct.location_id || ''}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, location_id: e.target.value })}
                                        >
                                            <option value="">-- No Default Location --</option>
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>
                                                    {loc.zone_name} - {loc.bin_code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 sm:ml-3 sm:w-auto transition-colors"
                                    >
                                        {isSubmitting ? 'Saving...' : 'Save Product'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-border-light hover:bg-surface-hover sm:mt-0 sm:w-auto transition-colors"
                                    >
                                        Cancel
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
