"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { autoDistributeTasks } from "@/app/actions/distribute-tasks";
import DispatcherPage from "./dispatch/page";

import {
    PackageMinus,
    Search,
    ChevronRight,
    Clock,
    PackageCheck,
    Truck,
    XCircle,
    Loader2,
    Users,
    ClipboardList,
    Wand2,
    CheckCircle2,
    Layers
} from "lucide-react";

// Types
type OrderStatus = 'PENDING' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'CANCELLED';

type SalesOrder = {
    id: string;
    order_number: string;
    customer_name: string;
    status: OrderStatus;
    total_items: number;
    created_at: string;
};

type UnassignedTask = {
    id: string;
    order_id: string;
    status: string;
    created_at: string;
    order: {
        order_number: string;
        customer_name: string;
        total_items: number;
    };
};

type Picker = {
    id: string;
    full_name: string;
};

const getStatusColor = (status: OrderStatus) => {
    switch (status) {
        case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'PICKING': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'PACKED': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'SHIPPED': return 'bg-green-100 text-green-800 border-green-200';
        case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
        case 'PENDING': return <Clock className="w-3.5 h-3.5" />;
        case 'PICKING': return <Loader2 className="w-3.5 h-3.5" />; // Or a custom pick icon
        case 'PACKED': return <PackageCheck className="w-3.5 h-3.5" />;
        case 'SHIPPED': return <Truck className="w-3.5 h-3.5" />;
        case 'CANCELLED': return <XCircle className="w-3.5 h-3.5" />;
        default: return null;
    }
};

export default function OutboundPage() {
    const supabase = createClient();
    const router = useRouter();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState<'orders' | 'assign' | 'dispatch'>('orders');
    const [userRole, setUserRole] = useState('');

    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [unassignedTasks, setUnassignedTasks] = useState<UnassignedTask[]>([]);
    const [pickers, setPickers] = useState<Picker[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isDistributing, setIsDistributing] = useState(false);
    const [isCreatingWave, setIsCreatingWave] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
    const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
    const [selectedWavePicker, setSelectedWavePicker] = useState<string>("");

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
            setUserRole(profile?.role || '');
        }
        await Promise.all([fetchOrders(), fetchAssignmentData()]);
        setIsLoading(false);
    };

    const fetchOrders = async () => {
        const { data, error } = await supabase
            .from('sales_orders')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setOrders(data);
    };

    const fetchAssignmentData = async () => {
        // Fetch Unassigned Pick Lists
        const { data: tasks } = await supabase
            .from('pick_lists')
            .select(`
                id, order_id, status, created_at,
                order:sales_orders (order_number, customer_name, total_items)
            `)
            .eq('status', 'OPEN')
            .is('assigned_to', null)
            .order('created_at', { ascending: false });

        if (tasks) setUnassignedTasks(tasks as any[]);

        // Fetch Pickers
        const { data: pickerData } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .eq('role', 'picker');

        if (pickerData) setPickers(pickerData);
    };

    // Filter Logic for Orders Tab
    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.customer_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const toggleTaskSelection = (taskId: string) => {
        const newSet = new Set(selectedTasks);
        if (newSet.has(taskId)) newSet.delete(taskId);
        else newSet.add(taskId);
        setSelectedTasks(newSet);
    };

    const toggleAllTasks = () => {
        if (selectedTasks.size === unassignedTasks.length) {
            setSelectedTasks(new Set());
        } else {
            setSelectedTasks(new Set(unassignedTasks.map(t => t.id)));
        }
    };

    const handleStartPicking = async (orderId: string) => {
        router.push(`/inventory/outbound/${orderId}/picking`);
    };

    // Task Delegation Handlers
    const handleManualAssign = async (taskId: string, pickerId: string) => {
        if (!pickerId) return;
        const { error } = await supabase.from('pick_lists').update({ assigned_to: pickerId }).eq('id', taskId);
        if (error) {
            toast.error("Assignment Failed", error.message);
        } else {
            toast.success("Task Assigned", "Picker notified.");
            fetchAssignmentData(); // Refresh unassigned list
        }
    };

    const handleAutoDistribute = async () => {
        if (unassignedTasks.length === 0) return;
        if (pickers.length === 0) {
            toast.warning("No Pickers", "There are no active pickers to distribute tasks to.");
            return;
        }

        setIsDistributing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No active session");

            const result = await autoDistributeTasks(`Bearer ${session.access_token}`);

            if (result.success) {
                toast.success("Tasks Distributed", result.message);
                fetchAssignmentData();
            } else {
                toast.error("Distribution Failed", result.error);
            }
        } catch (error: any) {
            toast.error("Error", error.message);
        } finally {
            setIsDistributing(false);
        }
    };

    const handleCreateWave = async () => {
        if (selectedTasks.size === 0) return;
        if (!selectedWavePicker) {
            toast.error("Validation Error", "Please select a picker for the wave first.");
            return;
        }

        setIsCreatingWave(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No active session");

            const taskIds = Array.from(selectedTasks);
            const { createWaveAction } = await import('@/app/actions/distribute-tasks');
            const result = await createWaveAction(`Bearer ${session.access_token}`, taskIds, selectedWavePicker);

            if (result.success) {
                toast.success("Wave Created", result.message);
                setSelectedTasks(new Set());
                setSelectedWavePicker("");
                fetchAssignmentData();
            } else {
                toast.error("Wave Creation Failed", result.error);
            }
        } catch (error: any) {
            toast.error("Error", error.message);
        } finally {
            setIsCreatingWave(false);
        }
    };

    const isManager = userRole === 'superadmin' || userRole === 'sup';

    return (
        <div className="space-y-6 animate-in fade-in pb-20 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <PackageMinus className="w-6 h-6 text-primary-600" />
                    Outbound Operations
                </h1>
                <p className="text-gray-500 text-sm mt-1">Manage sales orders, picking, packing, and dispatch.</p>
            </div>

            {/* Tabs (Only visible if Manager) */}
            {isManager && (
                <div className="flex space-x-1 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`py-3 px-6 inline-flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'orders'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <ClipboardList className="w-4 h-4" />
                        All Orders
                    </button>
                    <button
                        onClick={() => setActiveTab('assign')}
                        className={`py-3 px-6 relative inline-flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'assign'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <Users className="w-4 h-4" />
                        Task Delegation
                        {unassignedTasks.length > 0 && (
                            <span className="absolute top-2 right-2 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('dispatch')}
                        className={`py-3 px-6 relative inline-flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dispatch'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <Truck className="w-4 h-4" />
                        Fleet Dispatch
                    </button>
                </div>
            )}

            {/* --- ORDERS TAB --- */}
            {activeTab === 'orders' && (
                <>
                    {/* Filters Area */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by Order # or Customer..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                            {(['ALL', 'PENDING', 'PICKING', 'PACKED', 'SHIPPED', 'CANCELLED'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${statusFilter === status
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Orders List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-64 text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
                                <PackageMinus className="w-12 h-12 mb-4 text-gray-300" />
                                <h3 className="text-lg font-medium text-gray-900">No Orders Found</h3>
                                <p className="mt-1 text-sm">We couldn't find any orders matching your criteria.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4">Order Details</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4 text-center">Items</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-gray-900">{order.order_number}</div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-700">{order.customer_name}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 font-semibold text-gray-700">
                                                    {order.total_items}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                                                    {getStatusIcon(order.status)}
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {order.status === 'PENDING' && (
                                                    <button onClick={() => handleStartPicking(order.id)} className="inline-flex items-center gap-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 rounded-lg text-xs font-semibold transition-colors focus:ring-2 focus:ring-gray-900 focus:ring-offset-1">
                                                        Start Picking <ChevronRight className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {order.status === 'PACKED' && (
                                                    <Link href={`/inventory/outbound/${order.id}/shipping`} className="inline-flex items-center gap-1 px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg text-xs font-semibold transition-colors focus:ring-2 focus:ring-purple-600 focus:ring-offset-1">
                                                        Pack & Ship <Truck className="w-3.5 h-3.5" />
                                                    </Link>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}

            {/* --- ASSIGNMENT TAB --- */}
            {activeTab === 'assign' && isManager && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-5 rounded-xl border border-gray-100 gap-4">
                        <div>
                            <h3 className="font-semibold text-gray-900 text-lg">Unassigned Pick Lists</h3>
                            <p className="text-sm text-gray-500">Orders created automatically (e.g., via API webhook) require a picker to be assigned before processing begins.</p>
                            <div className="flex items-center gap-4 mt-3 text-sm font-medium">
                                <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 shadow-sm"><strong className="text-gray-900">{unassignedTasks.length}</strong> Pending Tasks</span>
                                <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 shadow-sm"><strong className="text-gray-900">{pickers.length}</strong> Active Pickers</span>
                            </div>
                        </div>
                        <button
                            onClick={handleAutoDistribute}
                            disabled={unassignedTasks.length === 0 || isDistributing}
                            className={`shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold shadow-md transition-all
                                ${unassignedTasks.length === 0
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-indigo-600 to-primary-600 text-white hover:from-indigo-700 hover:to-primary-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95'
                                }`}
                        >
                            {isDistributing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                            Auto-Distribute Tasks
                        </button>
                    </div>

                    {/* Bulk Action Bar for Wave Creation */}
                    {selectedTasks.size > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 text-blue-800">
                                <span className="font-bold">{selectedTasks.size}</span>
                                <span>tasks selected for Wave</span>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <select
                                    value={selectedWavePicker}
                                    onChange={(e) => setSelectedWavePicker(e.target.value)}
                                    className="flex-1 sm:w-48 text-sm rounded-lg border-blue-200 focus:ring-blue-500 focus:border-blue-500 py-2 bg-white"
                                >
                                    <option value="" disabled>Select Picker for Wave...</option>
                                    {pickers.map((p) => (
                                        <option key={p.id} value={p.id}>{p.full_name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleCreateWave}
                                    disabled={isCreatingWave || !selectedWavePicker}
                                    className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm
                                        ${(!selectedWavePicker || isCreatingWave)
                                            ? 'bg-blue-200 text-blue-400 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                                        }`}
                                >
                                    {isCreatingWave ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                                    Group into Wave
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {unassignedTasks.length === 0 ? (
                            <div className="p-16 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-1">Queue Empty</h3>
                                <p className="text-gray-500">All picking tasks have been assigned to your workforce.</p>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-4 text-left w-12">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                checked={unassignedTasks.length > 0 && selectedTasks.size === unassignedTasks.length}
                                                onChange={toggleAllTasks}
                                            />
                                        </th>
                                        <th className="px-6 py-4 text-left">Order Details</th>
                                        <th className="px-6 py-4 text-left">Customer</th>
                                        <th className="px-6 py-4 text-center">Items expected</th>
                                        <th className="px-6 py-4 text-left">Assign To Worker</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {unassignedTasks.map((task) => (
                                        <tr key={task.id} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                    checked={selectedTasks.has(task.id)}
                                                    onChange={() => toggleTaskSelection(task.id)}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-gray-900">{task.order?.order_number}</span>
                                                <div className="text-xs text-gray-500 mt-1">Created: {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-700">{task.order?.customer_name}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-gray-100 font-bold text-gray-800 border border-gray-200">
                                                    {task.order?.total_items}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    defaultValue=""
                                                    onChange={(e) => handleManualAssign(task.id, e.target.value)}
                                                    className="w-full max-w-[200px] text-sm rounded-lg border-gray-300 py-2 pl-3 pr-10 focus:ring-primary-500 focus:border-primary-500"
                                                >
                                                    <option value="" disabled>Select Picker...</option>
                                                    {pickers.map((p) => (
                                                        <option key={p.id} value={p.id}>{p.full_name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* --- DISPATCH TAB --- */}
            {activeTab === 'dispatch' && isManager && (
                <DispatcherPage />
            )}
        </div>
    );
}
