import { Package, AlertCircle, BarChart3, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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
    { name: "Total Products (SKUs)", value: totalSKUs.toLocaleString(), icon: Package, color: "text-primary-600", bg: "bg-primary-50" },
    { name: "Low Stock Alerts", value: lowStockCount.toLocaleString(), icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
    { name: "Total Quantity", value: totalQuantity.toLocaleString(), icon: BarChart3, color: "text-green-600", bg: "bg-green-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Real-time overview of your warehouse inventory.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((item) => (
          <div
            key={item.name}
            className="relative overflow-hidden rounded-xl bg-white px-4 pb-12 pt-5 shadow-sm ring-1 ring-border-light sm:px-6 sm:pt-6"
          >
            <dt>
              <div className={`absolute rounded-md p-3 ${item.bg}`}>
                <item.icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">
                {item.name}
              </p>
            </dt>
            <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p className="text-2xl font-semibold text-foreground">
                {item.value}
              </p>
            </dd>
          </div>
        ))}
      </div>

      {/* Low Stock Table */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Critical Low Stock Items
        </h2>
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-border-light overflow-hidden">
          {lowStockItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-light">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">SKU</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Product Name</th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">Current Stock</th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">Min Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light bg-white">
                  {lowStockItems.map((item) => (
                    <tr key={item.id} className="hover:bg-red-50/50 transition-colors">
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                        {item.sku}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">{item.name}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-bold text-red-600">
                        {item.quantity}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                        {item.min_stock_level}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">All Stock OK</h3>
              <p className="mt-1 text-sm text-gray-500">No products are currently under their minimum stock level.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
