"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
    Truck,
    CheckCircle2,
    Clock,
    User,
    Calendar,
    ArrowRight,
    MapPin,
    Loader2
} from "lucide-react";
import Link from "next/link";

type packedOrder = {
    id: string;
    order_number: string;
    customer_name: string;
    total_items: number;
    created_at: string;
};

type Vehicle = {
    id: string;
    license_plate: string;
    type: string;
};

type Driver = {
    id: string;
    name: string;
};

export default function DispatcherPage() {
    const router = useRouter();
    const supabase = createClient();
    const toast = useToast();

    // Data State
    const [packedOrders, setPackedOrders] = useState<packedOrder[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);

    // UI Loading States
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [selectedVehicle, setSelectedVehicle] = useState<string>("");
    const [selectedDriver, setSelectedDriver] = useState<string>("");
    const [tripDate, setTripDate] = useState<string>(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        fetchDispatchData();
    }, []);

    const fetchDispatchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch PACKED (ready to ship) orders that aren't assigned to a trip yet
            // Assuming trip_id is added in Phase 12 schema
            const { data: ordersData } = await supabase
                .from('sales_orders')
                .select('id, order_number, customer_name, total_items, created_at')
                .eq('status', 'PACKED')
                .is('trip_id', null)
                .order('created_at', { ascending: true });

            if (ordersData) setPackedOrders(ordersData as any[]);

            // 2. Fetch Active Vehicles
            // NOTE: The tables might not exist until the user runs the Phase 12 migration.
            // We wrap this in a try-catch so the UI doesn't completely break for them.
            try {
                const { data: vData } = await supabase.from('vehicles').select('*').eq('status', 'ACTIVE');
                if (vData) setVehicles(vData);

                const { data: dData } = await supabase.from('drivers').select('*').eq('status', 'ACTIVE');
                if (dData) setDrivers(dData);
            } catch (ignoreDbErrors) {
                console.warn("Phase 12 tables missing. Please run the SQL migration.");
            }

        } catch (error) {
            console.error("Error fetching dispatch data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleOrderSelection = (id: string) => {
        setSelectedOrders(prev =>
            prev.includes(id) ? prev.filter(oId => oId !== id) : [...prev, id]
        );
    };

    const handleCreateTrip = async (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedOrders.length === 0) {
            toast.warning("No Orders", "Please select at least one order to dispatch.");
            return;
        }

        if (!selectedVehicle || !selectedDriver) {
            toast.error("Incomplete", "Please select both a Vehicle and a Driver.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // 1. Create Trip
            const tripNum = `TRP-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

            const { data: tripData, error: tripError } = await supabase
                .from('delivery_trips')
                .insert({
                    trip_number: tripNum,
                    vehicle_id: selectedVehicle,
                    driver_id: selectedDriver,
                    scheduled_date: tripDate,
                    created_by: user?.id,
                    status: 'ASSIGNED'
                })
                .select()
                .single();

            if (tripError) throw tripError;

            // 2. Update Orders with Trip ID and change status to 'DISPATCHED' (or keep as PACKED until driver starts)
            const { error: updateError } = await supabase
                .from('sales_orders')
                .update({
                    trip_id: tripData.id,
                    // Optionally generate an internal tracking number here
                    internal_tracking_number: `CLM-${tripNum.split('-')[1]}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
                })
                .in('id', selectedOrders);

            if (updateError) throw updateError;

            toast.success("Trip Created", `Trip ${tripNum} assigned successfully!`);
            setSelectedOrders([]);
            setSelectedVehicle("");
            setSelectedDriver("");
            fetchDispatchData(); // Refresh list

        } catch (error: any) {
            console.error("Failed to create trip:", error);
            // Check if failure is due to missing tables
            if (error.code === '42P01') {
                toast.error("Database Missing", "Please run the Phase 12 SQL Migration first.");
            } else {
                toast.error("Error", "Failed to clear dispatch orders.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Fleet Dispatch (TMS)</h1>
                    <p className="text-sm text-gray-500 mt-1">Assign packed orders to delivery trips.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Side: Unassigned Packed Orders */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-indigo-600" />
                                Orders Awaiting Dispatch
                            </h2>
                            <span className="text-sm bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-bold">
                                {packedOrders.length} Orders
                            </span>
                        </div>

                        {isLoading ? (
                            <div className="p-12 flex justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                            </div>
                        ) : packedOrders.length === 0 ? (
                            <div className="p-12 flex flex-col items-center text-center text-gray-500">
                                <CheckCircle2 className="w-12 h-12 text-gray-300 mb-3" />
                                <p className="font-medium text-gray-900">All caught up!</p>
                                <p className="text-sm">There are no packed orders waiting to be dispatched.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                                {packedOrders.map(order => (
                                    <label key={order.id} className={`flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedOrders.includes(order.id) ? 'bg-indigo-50/30' : ''}`}>
                                        <div className="pt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={selectedOrders.includes(order.id)}
                                                onChange={() => toggleOrderSelection(order.id)}
                                                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <p className="font-bold text-gray-900">{order.order_number}</p>
                                                <span className="text-sm font-semibold text-gray-500">{order.total_items} Items</span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">{order.customer_name}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Trip Creation Setup */}
                <div className="space-y-6">
                    <form onSubmit={handleCreateTrip} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
                            <Truck className="w-5 h-5 text-indigo-600" />
                            Draft Delivery Trip
                        </h2>

                        <div className="space-y-5 cursor-default">
                            {/* Selected Orders Notice */}
                            <div className={`p-4 rounded-xl border ${selectedOrders.length > 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-200 border-dashed'}`}>
                                <p className={`text-sm font-bold flex items-center justify-between ${selectedOrders.length > 0 ? 'text-indigo-900' : 'text-gray-500'}`}>
                                    Selected for routing
                                    <span className={`text-lg px-2 rounded-md ${selectedOrders.length > 0 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                                        {selectedOrders.length}
                                    </span>
                                </p>
                            </div>

                            <hr className="border-gray-100" />

                            {vehicles.length === 0 ? (
                                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                                    <p className="font-bold">Missing Dependency</p>
                                    <p className="mt-1">Please insert Vehicles and Drivers into your Supabase tables to assign trips.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Select Vehicle */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2"><Truck className="w-4 h-4" /> Transport Vehicle</label>
                                        <select
                                            value={selectedVehicle}
                                            onChange={e => setSelectedVehicle(e.target.value)}
                                            required
                                            className="w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5"
                                        >
                                            <option value="">Select Vehicle...</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>{v.license_plate} ({v.type})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Select Driver */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2"><User className="w-4 h-4" /> Assigned Driver</label>
                                        <select
                                            value={selectedDriver}
                                            onChange={e => setSelectedDriver(e.target.value)}
                                            required
                                            className="w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5"
                                        >
                                            <option value="">Select Driver...</option>
                                            {drivers.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Set Date */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2"><Calendar className="w-4 h-4" /> Delivery Date</label>
                                        <input
                                            type="date"
                                            value={tripDate}
                                            onChange={e => setTripDate(e.target.value)}
                                            required
                                            className="w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2.5"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || selectedOrders.length === 0 || vehicles.length === 0}
                            className={`mt-8 w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white transition-all ${selectedOrders.length > 0 && vehicles.length > 0
                                ? 'bg-gray-900 hover:bg-black hover:shadow-lg active:scale-95'
                                : 'bg-gray-300 cursor-not-allowed'
                                }`}
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Dispatch Trip"}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
