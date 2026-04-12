import { Package, AlertCircle, BarChart3, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name, quantity, min_stock_level")
    .order("quantity", { ascending: true });

  const totalSKUs = products?.length ?? 0;

  let totalQuantity = 0;
  let lowStockCount = 0;
  const lowStockItems: typeof products = [];

  for (const product of products ?? []) {
    totalQuantity += product.quantity;
    if (product.quantity <= product.min_stock_level) {
      lowStockCount++;
      if (lowStockItems.length < 10) {
        lowStockItems.push(product);
      }
    }
  }

  const allStockHealthy = lowStockCount === 0;

  // A friendly greeting based on the time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const stats = [
    {
      name: "Products in stock",
      value: totalSKUs.toLocaleString(),
      caption: "unique SKUs tracked",
      icon: Package,
      accent: "from-blue-500 to-indigo-500",
      soft: "bg-blue-50 text-blue-600",
    },
    {
      name: "Items need attention",
      value: lowStockCount.toLocaleString(),
      caption: lowStockCount === 1 ? "item running low" : "items running low",
      icon: AlertCircle,
      accent: "from-rose-500 to-red-500",
      soft: "bg-rose-50 text-rose-600",
    },
    {
      name: "Units on hand",
      value: totalQuantity.toLocaleString(),
      caption: "total inventory units",
      icon: BarChart3,
      accent: "from-emerald-500 to-teal-500",
      soft: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500">

      {/* Warm header */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-indigo-500 tracking-wide uppercase">
          {greeting} 👋
        </p>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight leading-snug">
          Here's what's happening in your warehouse
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Last synced just now · Everything below updates in real-time
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((item, i) => (
          <div
            key={item.name}
            style={{ animationDelay: `${i * 80}ms` }}
            className="animate-in fade-in slide-in-from-bottom-3 duration-500 group relative flex items-start gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
          >
            {/* Subtle gradient stripe on left */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b ${item.accent}`} />

            <div className={`shrink-0 p-2.5 rounded-xl ${item.soft}`}>
              <item.icon className="h-5 w-5" aria-hidden="true" />
            </div>

            <div>
              <p className="text-sm text-gray-500">{item.name}</p>
              <p className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none mt-0.5">
                {item.value}
              </p>
              <p className="text-xs text-gray-400 mt-1">{item.caption}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Low Stock · Critical Items
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {allStockHealthy
                  ? "Nothing to worry about right now"
                  : `Showing ${lowStockItems.length} of ${lowStockCount} items below minimum`}
              </p>
            </div>
          </div>

          {!allStockHealthy && (
            <Link
              href="/inventory/products"
              className="group/link inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>

        {allStockHealthy ? (
          /* Happy empty state */
          <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
            <div className="relative mb-5">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center ring-8 ring-emerald-50">
                <Sparkles className="h-9 w-9 text-emerald-500" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              You're all caught up!
            </h3>
            <p className="mt-2 text-sm text-gray-400 max-w-xs leading-relaxed">
              Every product is sitting comfortably above its minimum level. Nice work keeping things topped up.
            </p>
            <Link
              href="/inventory/products"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Browse all products <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50/60">
                  <th className="py-3 pl-6 pr-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    In Stock
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Minimum
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lowStockItems.map((item, i) => {
                  const deficit = item.min_stock_level - item.quantity;
                  const isVeryLow = item.quantity === 0;

                  return (
                    <tr
                      key={item.id}
                      style={{ animationDelay: `${i * 40}ms` }}
                      className="animate-in fade-in duration-300 hover:bg-gray-50/70 transition-colors"
                    >
                      <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-mono font-medium text-gray-700">
                        {item.sku}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-800 font-medium">
                        {item.name}
                        {isVeryLow && (
                          <span className="ml-2 text-xs font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">
                            Out of stock
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold border
                            ${isVeryLow
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-orange-100 text-orange-700 border-orange-200"
                            }`}
                        >
                          {item.quantity}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-right text-gray-400">
                        {item.min_stock_level}
                        <span className="ml-1.5 text-xs text-red-400">
                          (−{deficit})
                        </span>
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
