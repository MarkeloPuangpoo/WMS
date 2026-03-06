"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    ClipboardList,
    Loader2,
    PackageSearch,
    ArrowRight,
    MapPin,
    Package,
    Clock,
    CheckCircle2,
    PlayCircle,
    Truck,
    User,
    Layers
} from "lucide-react";
import Link from "next/link";

type PickTask = {
    id: string;
    order_id: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    order: {
        order_number: string;
        customer_name: string;
        status: string;
        total_items: number;
    } | null;
};

type WaveTask = {
    id: string;
    wave_number: string;
    status: string;
    created_at: string;
    pick_lists: {
        id: string;
        order: { total_items: number };
    }[];
};

type PackTask = {
    id: string;
    order_number: string;
    customer_name: string;
    status: string;
    total_items: number;
};

export default function MyTasksPage() {
    const supabase = createClient();
    const [role, setRole] = useState<string>("");
    const [userId, setUserId] = useState<string>("");
    const [pickTasks, setPickTasks] = useState<PickTask[]>([]);
    const [waveTasks, setWaveTasks] = useState<WaveTask[]>([]);
    const [sortTasks, setSortTasks] = useState<WaveTask[]>([]);
    const [packTasks, setPackTasks] = useState<PackTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);

        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const userRole = profile?.role || 'user';
        setRole(userRole);

        if (userRole === 'picker' || userRole === 'superadmin' || userRole === 'sup') {
            // Fetch standalone pick lists assigned to this user (exclude those in a wave)
            let query = supabase
                .from('pick_lists')
                .select(`
                    id, order_id, status, started_at, completed_at, created_at,
                    order:sales_orders (order_number, customer_name, status, total_items)
                `)
                .is('wave_id', null)
                .in('status', ['OPEN', 'IN_PROGRESS'])
                .order('created_at', { ascending: false });

            if (userRole === 'picker') {
                query = query.eq('assigned_to', user.id);
            }

            // Fetch wave batches assigned to this user
            let waveQuery = supabase
                .from('wave_picks')
                .select(`
                    id, wave_number, status, created_at,
                    pick_lists (
                        id, order:sales_orders (total_items)
                    )
                `)
                .in('status', ['OPEN', 'IN_PROGRESS'])
                .order('created_at', { ascending: false });

            if (userRole === 'picker') {
                waveQuery = waveQuery.eq('assigned_to', user.id);
            }

            const [pickData, waveData] = await Promise.all([query, waveQuery]);
            if (pickData.data) setPickTasks(pickData.data as any[]);
            if (waveData.data) setWaveTasks(waveData.data as any[]);
        }

        if (userRole === 'packer' || userRole === 'superadmin' || userRole === 'sup') {
            // Fetch completed Waves that still have PICKED orders (needs sorting)
            const { data: completedWaves } = await supabase
                .from('wave_picks')
                .select(`
                    id, wave_number, status, created_at,
                    pick_lists (
                        id, order:sales_orders (status, total_items)
                    )
                `)
                .eq('status', 'COMPLETED')
                .order('completed_at', { ascending: false });

            if (completedWaves) {
                // Filter locally: only keep waves where at least one order is 'PICKED'
                const needsSorting = completedWaves.filter(wave =>
                    wave.pick_lists?.some((pl: any) => pl.order?.status === 'PICKED')
                );
                setSortTasks(needsSorting as any[]);
            }

            // Fetch standalone orders ready for shipping (status = PACKED)
            // Note: Picker app sets single orders to PACKED when done.
            const { data } = await supabase
                .from('sales_orders')
                .select('id, order_number, customer_name, status, total_items')
                .eq('status', 'PACKED')
                .order('created_at', { ascending: false });

            if (data) setPackTasks(data as any[]);
        }

        setIsLoading(false);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 text-gray-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p>Loading your tasks...</p>
            </div>
        );
    }

    const isPickerView = role === 'picker' || role === 'superadmin' || role === 'sup';
    const isPackerView = role === 'packer' || role === 'superadmin' || role === 'sup';

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <ClipboardList className="w-6 h-6 text-primary-600" />
                    My Tasks
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                    {role === 'picker' ? 'Your assigned picking tasks for today.' :
                        role === 'packer' ? 'Orders ready for packing and shipping.' :
                            'All operational tasks overview.'}
                </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {isPickerView && (
                    <>
                        <StatCard
                            label="Open Picks"
                            value={pickTasks.filter(t => t.status === 'OPEN').length + waveTasks.filter(t => t.status === 'OPEN').length}
                            icon={<PackageSearch className="w-5 h-5" />}
                            color="bg-blue-50 text-blue-700 border-blue-200"
                        />
                        <StatCard
                            label="In Progress"
                            value={pickTasks.filter(t => t.status === 'IN_PROGRESS').length + waveTasks.filter(t => t.status === 'IN_PROGRESS').length}
                            icon={<PlayCircle className="w-5 h-5" />}
                            color="bg-amber-50 text-amber-700 border-amber-200"
                        />
                    </>
                )}
                {isPackerView && (
                    <>
                        <StatCard
                            label="Sort Queues"
                            value={sortTasks.length}
                            icon={<Layers className="w-5 h-5" />}
                            color="bg-indigo-50 text-indigo-700 border-indigo-200"
                        />
                        <StatCard
                            label="Ready to Ship"
                            value={packTasks.length}
                            icon={<Truck className="w-5 h-5" />}
                            color="bg-purple-50 text-purple-700 border-purple-200"
                        />
                    </>
                )}
            </div>

            {/* Picking Tasks & Waves */}
            {isPickerView && (
                <div className="space-y-8">
                    {/* Wave Batches Section */}
                    {waveTasks.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-indigo-600" />
                                Wave Batches (Grouped)
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {waveTasks.map(wave => {
                                    // Calculate total items across all orders in the wave
                                    const totalItems = wave.pick_lists?.reduce((sum, pl) => sum + (pl.order?.total_items || 0), 0) || 0;
                                    const totalOrders = wave.pick_lists?.length || 0;

                                    return (
                                        <TaskCard
                                            key={wave.id}
                                            orderId={wave.id}
                                            orderNumber={wave.wave_number}
                                            customer={`${totalOrders} Orders Batch`}
                                            totalItems={totalItems}
                                            status={wave.status}
                                            createdAt={wave.created_at}
                                            actionHref={`/inventory/outbound/wave/${wave.id}/picking`}
                                            actionLabel={wave.status === 'OPEN' ? 'Start Wave Pick' : 'Continue Wave'}
                                            statusColor={wave.status === 'OPEN' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-amber-100 text-amber-700 border-amber-200'}
                                            iconOverride={<Layers className="w-3.5 h-3.5" />}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Standalone Picking Tasks Section */}
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <PackageSearch className="w-5 h-5 text-blue-600" />
                            Single Order Picks
                        </h2>
                        {pickTasks.length === 0 && waveTasks.length === 0 ? (
                            <EmptyState icon={<CheckCircle2 className="w-10 h-10 text-emerald-400" />} title="All caught up!" message="No pending picking tasks right now." />
                        ) : pickTasks.length === 0 ? null : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {pickTasks.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        orderId={task.order_id}
                                        orderNumber={task.order?.order_number || 'N/A'}
                                        customer={task.order?.customer_name || 'Unknown'}
                                        totalItems={task.order?.total_items || 0}
                                        status={task.status}
                                        createdAt={task.created_at}
                                        actionHref={`/inventory/outbound/${task.order_id}/picking`}
                                        actionLabel={task.status === 'OPEN' ? 'Start Picking' : 'Continue'}
                                        statusColor={task.status === 'OPEN' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-amber-100 text-amber-700 border-amber-200'}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    {packTasks.length === 0 && sortTasks.length === 0 ? (
                        <EmptyState icon={<CheckCircle2 className="w-10 h-10 text-emerald-400" />} title="Nothing to pack!" message="No orders are ready for packing right now." />
                    ) : packTasks.length === 0 ? null : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {packTasks.map(task => (
                                <TaskCard
                                    key={task.id}
                                    orderId={task.id}
                                    orderNumber={task.order_number}
                                    customer={task.customer_name}
                                    totalItems={task.total_items}
                                    status="PICKED"
                                    createdAt=""
                                    actionHref={`/inventory/outbound/${task.id}/shipping`}
                                    actionLabel="Start Packing"
                                    statusColor="bg-purple-100 text-purple-700 border-purple-200"
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Reusable Components
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
    return (
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${color} transition-all hover:shadow-sm`}>
            <div className="p-2.5 bg-white/60 rounded-lg shadow-sm">{icon}</div>
            <div>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-xs font-medium opacity-80 mt-0.5">{label}</p>
            </div>
        </div>
    );
}

function TaskCard({ orderId, orderNumber, customer, totalItems, status, createdAt, actionHref, actionLabel, statusColor, iconOverride }: {
    orderId: string; orderNumber: string; customer: string; totalItems: number;
    status: string; createdAt: string; actionHref: string; actionLabel: string; statusColor: string; iconOverride?: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-lg font-bold text-gray-900">{orderNumber}</p>
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                        {iconOverride ? iconOverride : <User className="w-3.5 h-3.5" />}
                        {customer}
                    </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>
                    {status === 'OPEN' ? 'New' : status === 'IN_PROGRESS' ? 'In Progress' : status}
                </span>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500 mb-5">
                <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    <span>{totalItems} items</span>
                </div>
                {createdAt && (
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}</span>
                    </div>
                )}
            </div>

            <Link
                href={actionHref}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
            >
                {actionLabel}
                <ArrowRight className="w-4 h-4" />
            </Link>
        </div>
    );
}

function EmptyState({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
            <div className="mb-4">{icon}</div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
        </div>
    );
}
