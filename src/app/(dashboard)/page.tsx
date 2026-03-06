import { Package, AlertCircle, BarChart3, AlertTriangle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();

  // Fetch all products to calculate metrics
  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name, quantity, min_stock_level")
    .order("quantity", { ascending: true }); // Order by lowest quantity first

  const totalSKUs = products?.length || 0;

  let totalQuantity = 0;
  let lowStockCount = 0;
  const lowStockItems = [];

  if (products) {
    for (const product of products) {
      totalQuantity += product.quantity;
      if (product.quantity <= product.min_stock_level) {
        lowStockCount++;
        // Limit the low stock display table to top 10 worst offenders
        if (lowStockItems.length < 10) {
          lowStockItems.push(product);
        }
      }
    }
  }

  const stats = [
    {
      name: "Total Products (SKUs)",
      value: totalSKUs.toLocaleString(),
      icon: Package,
      color: "text-primary-600",
      bg: "bg-primary-50",
      borderColor: "border-primary-100"
    },
    {
      name: "Low Stock Alerts",
      value: lowStockCount.toLocaleString(),
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50",
      borderColor: "border-red-100"
    },
    {
      name: "Total Quantity",
      value: totalQuantity.toLocaleString(),
      icon: BarChart3,
      color: "text-green-600",
      bg: "bg-green-50",
      borderColor: "border-green-100"
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Monitor your warehouse inventory, track stock levels, and manage critical alerts in real-time.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((item) => (
          <div
            key={item.name}
            className="group flex items-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100 transition-all duration-200 hover:shadow-md hover:border-gray-200"
          >
            <div className={`p-4 rounded-xl ${item.bg} ${item.borderColor} border mr-5 transition-transform duration-200 group-hover:scale-105`}>
              <item.icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                {item.name}
              </p>
              <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                {item.value}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Section Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Critical Low Stock</h2>
              <p className="text-xs text-gray-500 mt-0.5">Items currently at or below minimum stock level</p>
            </div>
          </div>
          <Link
            href="/inventory/products"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Table Content */}
        {lowStockItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th scope="col" className="py-4 pl-6 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                  <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                  <th scope="col" className="px-3 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Stock</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Min Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {lowStockItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900">
                      {item.sku}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 font-medium">
                      {item.name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                        {item.quantity}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-right text-gray-400">
                      {item.min_stock_level}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center flex flex-col items-center justify-center bg-gray-50/30">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 ring-8 ring-green-50">
              <Package className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">All Stock is Healthy</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
              Great job! You currently don't have any products that have fallen below their minimum stock levels.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}