"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, MapPin, LayoutDashboard, Settings, Activity } from "lucide-react";

export function Sidebar({ role }: { role?: string }) {
    const pathname = usePathname();

    const navigation = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Products", href: "/inventory/products", icon: Package },
        { name: "Locations", href: "/inventory/locations", icon: MapPin },
        { name: "Transactions", href: "/inventory/transactions", icon: Activity },
    ];

    if (role === 'superadmin') {
        navigation.push({ name: "Settings", href: "/settings", icon: Settings });
    }

    return (
        <div className="flex flex-col w-64 bg-white border-r border-border-light h-full">
            <div className="flex items-center justify-center h-16 border-b border-border-light">
                <h1 className="text-xl font-bold text-primary-600 tracking-tight">colamarc</h1>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2">
                {navigation.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-150 ${isActive
                                ? "bg-primary-50 text-primary-600"
                                : "text-foreground hover:bg-surface-hover hover:text-primary-600"
                                }`}
                        >
                            <item.icon className="w-5 h-5 mr-3" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
