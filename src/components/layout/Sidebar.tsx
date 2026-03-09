"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Package, MapPin, LayoutDashboard, Settings, Activity, Box,
    PackagePlus, PackageMinus, Layers, ClipboardList, SlidersHorizontal,
    LucideIcon,
    X, Truck
} from "lucide-react";

type NavItem = {
    name: string;
    href: string;
    icon: LucideIcon;
};

type NavGroup = {
    label: string;
    items: NavItem[];
};

function getNavGroups(role?: string): NavGroup[] {
    const groups: NavGroup[] = [];

    // Picker: Only see My Tasks + Lot Inventory (read-only reference)
    if (role === 'picker') {
        groups.push({
            label: "My Work",
            items: [
                { name: "My Tasks", href: "/my-tasks", icon: ClipboardList },
                { name: "Lot Inventory", href: "/inventory/lots", icon: Layers },
            ]
        });
        return groups;
    }

    // Packer: Only see My Tasks
    if (role === 'packer') {
        groups.push({
            label: "My Work",
            items: [
                { name: "My Tasks", href: "/my-tasks", icon: ClipboardList },
            ]
        });
        return groups;
    }

    // User: Dashboard only
    if (role === 'user') {
        groups.push({
            label: "Main Menu",
            items: [
                { name: "Dashboard", href: "/", icon: LayoutDashboard },
            ]
        });
        return groups;
    }

    // Manager (sup) & Admin (superadmin): Full access
    groups.push({
        label: "Overview",
        items: [
            { name: "Dashboard", href: "/", icon: LayoutDashboard },
        ]
    });

    groups.push({
        label: "Inventory",
        items: [
            { name: "Products", href: "/inventory/products", icon: Package },
            { name: "Locations", href: "/inventory/locations", icon: MapPin },
            { name: "Lot Inventory", href: "/inventory/lots", icon: Layers },
            { name: "Transactions", href: "/inventory/transactions", icon: Activity },
            { name: "Adjustments", href: "/inventory/adjustments", icon: SlidersHorizontal },
        ]
    });

    groups.push({
        label: "Operations",
        items: [
            { name: "Inbound", href: "/inventory/inbound", icon: PackagePlus },
            { name: "Outbound", href: "/inventory/outbound", icon: PackageMinus },
            { name: "Fleet Management", href: "/inventory/fleet", icon: Truck },
            { name: "My Tasks", href: "/my-tasks", icon: ClipboardList },
        ]
    });

    if (role === 'superadmin') {
        groups.push({
            label: "System",
            items: [
                { name: "Settings", href: "/settings", icon: Settings },
                { name: "Integrations", href: "/settings/integrations", icon: Activity },
            ]
        });
    }

    return groups;
}

export function Sidebar({ role, isOpen, onClose }: { role?: string; isOpen: boolean; onClose: () => void }) {
    const pathname = usePathname();
    const navGroups = getNavGroups(role);

    return (
        <aside className={`fixed md:relative flex flex-col w-64 bg-white border-r border-gray-200 h-[100dvh] shadow-xl md:shadow-sm z-50 transition-transform duration-300 ease-in-out shrink-0 ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
            {/* Logo Section */}
            <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="bg-primary-600 p-1.5 rounded-lg shadow-sm">
                        <Box className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">Colamarc</h1>
                </div>
                {/* Mobile Close Button */}
                <button onClick={onClose} className="md:hidden p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg bg-gray-50">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Navigation Section */}
            <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
                {navGroups.map((group) => (
                    <div key={group.label}>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-2 px-3">
                            {group.label}
                        </div>
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${isActive
                                            ? "bg-primary-50 text-primary-700"
                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                            }`}
                                    >
                                        <item.icon
                                            className={`w-5 h-5 mr-3 flex-shrink-0 transition-colors duration-200 ${isActive ? "text-primary-600" : "text-gray-400 group-hover:text-gray-600"
                                                }`}
                                        />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Role Badge */}
            <div className="px-4 py-3 border-t border-gray-100">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${role === 'superadmin' ? 'bg-red-500' :
                        role === 'sup' ? 'bg-amber-500' :
                            role === 'picker' ? 'bg-blue-500' :
                                role === 'packer' ? 'bg-purple-500' :
                                    'bg-gray-400'
                        }`} />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {role === 'superadmin' ? 'Admin' :
                            role === 'sup' ? 'Manager' :
                                role === 'picker' ? 'Picker' :
                                    role === 'packer' ? 'Packer' :
                                        'User'}
                    </span>
                </div>
            </div>
        </aside>
    );
}