"use client";

import { useState } from "react";
import { Plus, Search, Edit2, Trash2, Package, Filter } from "lucide-react";

type Product = {
    id: string;
    sku: string;
    name: string;
    description: string;
    quantity: number;
    min_stock_level: number;
    location_id?: string;
};

export default function ProductsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);

    // Mock Data for Layout building
    const [products, setProducts] = useState<Product[]>([
        { id: "1", sku: "SKU-001", name: "Wireless Mouse", description: "Ergonomic wireless mouse", quantity: 150, min_stock_level: 20 },
        { id: "2", sku: "SKU-002", name: "Mechanical Keyboard", description: "Blue switches", quantity: 5, min_stock_level: 10 },
        { id: "3", sku: "SKU-003", name: "USB-C Hub", description: "7-in-1 adapter", quantity: 45, min_stock_level: 15 },
        { id: "4", sku: "SKU-004", name: "Laptop Stand", description: "Aluminum adjustable stand", quantity: 8, min_stock_level: 10 },
    ]);

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
                <div className="mt-4 sm:ml-4 sm:mt-0">
                    <button
                        type="button"
                        className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors"
                    >
                        <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                        Add New Product
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm ring-1 ring-border-light overflow-hidden">
                <div className="p-4 border-b border-border-light flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative rounded-md shadow-sm max-w-sm w-full">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            name="search"
                            id="search"
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
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light bg-white">
                            {filteredProducts.map((product) => {
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
                                            <div className="text-xs text-gray-400 truncate max-w-xs">{product.description}</div>
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
                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <button className="text-primary-600 hover:text-primary-900 mr-4 transition-colors">
                                                <Edit2 className="h-4 w-4 inline" />
                                                <span className="sr-only">Edit {product.name}</span>
                                            </button>
                                            <button className="text-red-600 hover:text-red-900 transition-colors">
                                                <Trash2 className="h-4 w-4 inline" />
                                                <span className="sr-only">Delete {product.name}</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-sm text-gray-500">
                                        No products found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
