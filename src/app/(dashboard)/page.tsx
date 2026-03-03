import { Package, AlertCircle, BarChart3 } from "lucide-react";

export default function Home() {
  const stats = [
    { name: "Total Products (SKUs)", value: "1,240", icon: Package, color: "text-primary-600", bg: "bg-primary-50" },
    { name: "Low Stock Alerts", value: "12", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
    { name: "Total Quantity", value: "45,000", icon: BarChart3, color: "text-green-600", bg: "bg-green-50" },
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

      {/* Recent Activity / Low Stock Table Placeholder */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-foreground mb-4">Low Stock Items</h2>
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-border-light overflow-hidden">
          <div className="p-6 text-center text-gray-500 text-sm">
            Supabase integration pending...
          </div>
        </div>
      </div>
    </div>
  );
}
