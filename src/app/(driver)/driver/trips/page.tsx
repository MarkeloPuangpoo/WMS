"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
    MapPin,
    Package,
    Navigation,
    Clock,
    CheckCircle2,
    Truck,
    Loader2,
    CalendarDays
} from "lucide-react";
import Link from "next/link";

type DeliveryTrip = {
    id: string;
    trip_number: string;
    status: 'ASSIGNED' | 'IN_TRANSIT' | 'COMPLETED';
    scheduled_date: string;
    vehicle: { license_plate: string };
    _count: { orders: number };
};

export default function DriverTripsPage() {
    const router = useRouter();
    const supabase = createClient();
    const toast = useToast();

    const [trips, setTrips] = useState<DeliveryTrip[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchDriverTrips();
    }, []);

    const fetchDriverTrips = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            // 1. Get the driver profile ID linked to this user
            const { data: driverData } = await supabase
                .from('drivers')
                .select('id')
                .eq('user_id', user.id)
                .single();

            // If no driver record is linked, they shouldn't be here (or DB isn't migrated)
            if (!driverData) {
                console.warn("User is not registered as a driver in the drivers table.");
                // For demo purposes, we will fetch ALL trips if they aren't a driver, just to show UI
            }

            const driverId = driverData?.id;

            // 2. Fetch Trips assigned to this driver
            let query = supabase
                .from('delivery_trips')
                .select(`
                    id, 
                    trip_number, 
                    status, 
                    scheduled_date,
                    vehicle:vehicles (license_plate)
                `)
                .order('scheduled_date', { ascending: true });

            if (driverId) {
                query = query.eq('driver_id', driverId);
            }

            const { data: tripData, error } = await query;
            if (error) throw error;

            // 3. Manually aggregate order counts per trip (Supabase JS doesn't do Prisma-like _count well without RCPs)
            const tripsWithCounts = await Promise.all((tripData || []).map(async (trip) => {
                const { count } = await supabase
                    .from('sales_orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('trip_id', trip.id);

                return { ...trip, _count: { orders: count || 0 } } as DeliveryTrip;
            }));

            setTrips(tripsWithCounts);

        } catch (error) {
            console.error("Error fetching trips:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartTrip = async (tripId: string) => {
        try {
            const { error } = await supabase
                .from('delivery_trips')
                .update({
                    status: 'IN_TRANSIT',
                    started_at: new Date().toISOString()
                })
                .eq('id', tripId);

            if (error) throw error;

            toast.success("Trip Started", "Drive safely!");
            fetchDriverTrips();

        } catch (err: any) {
            toast.error("Error", err.message);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Loading routing data...</p>
            </div>
        );
    }

    const activeTrip = trips.find(t => t.status === 'IN_TRANSIT');
    const assignedTrips = trips.filter(t => t.status === 'ASSIGNED');
    const completedTrips = trips.filter(t => t.status === 'COMPLETED');

    return (
        <div className="p-4 space-y-6 pb-24">

            {/* Active Trip Banner */}
            {activeTrip && (
                <div className="bg-indigo-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden animate-in zoom-in-95">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Truck className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <span className="bg-indigo-500/50 text-indigo-100 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-400/30 uppercase tracking-wider">
                            Currently Driving
                        </span>
                        <h2 className="text-2xl font-black mt-3 mb-1">{activeTrip.trip_number}</h2>
                        <div className="flex items-center gap-4 text-indigo-100 text-sm mb-5">
                            <span className="flex items-center gap-1.5"><Package className="w-4 h-4" /> {activeTrip._count.orders} Drops</span>
                            <span className="flex items-center gap-1.5"><Truck className="w-4 h-4" /> {(activeTrip.vehicle as any)?.license_plate}</span>
                        </div>

                        <Link
                            href={`/driver/trips/${activeTrip.id}`}
                            className="w-full flex items-center justify-center gap-2 bg-white text-indigo-600 py-3.5 rounded-xl font-bold shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
                        >
                            Open Routing Navigation <Navigation className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            )}

            {/* Upcoming Trips */}
            <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-indigo-600" />
                    Upcoming Routes
                </h3>

                {assignedTrips.length === 0 && !activeTrip ? (
                    <div className="bg-gray-50 border border-gray-200 border-dashed rounded-2xl p-8 text-center text-gray-500">
                        <CheckCircle2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="font-medium">No assigned trips today</p>
                        <p className="text-sm">Enjoy your rest!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {assignedTrips.map(trip => (
                            <div key={trip.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-bold text-gray-900 text-lg">{trip.trip_number}</p>
                                        <p className="text-sm text-gray-500">Scheduled: {new Date(trip.scheduled_date).toLocaleDateString()}</p>
                                    </div>
                                    <span className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded-lg text-xs">ASSIGNED</span>
                                </div>

                                <div className="flex items-center justify-between mt-2 pt-3 border-t border-gray-100">
                                    <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                                        <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md"><Package className="w-4 h-4 text-gray-500" /> {trip._count.orders}</span>
                                        <span className="flex items-center gap-1"><Truck className="w-4 h-4 text-gray-500" /> {(trip.vehicle as any)?.license_plate}</span>
                                    </div>

                                    <button
                                        onClick={() => handleStartTrip(trip.id)}
                                        disabled={!!activeTrip}
                                        className={`px-4 py-2 ${!!activeTrip ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white shadow-md active:scale-95'} rounded-xl text-sm font-bold transition-transform`}
                                    >
                                        Start Trip
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Completed */}
            {completedTrips.length > 0 && (
                <div className="pt-4 border-t border-gray-200">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        Completed Recently
                    </h3>
                    <div className="space-y-2 opacity-70">
                        {completedTrips.map(trip => (
                            <div key={trip.id} className="bg-white border border-gray-200 rounded-xl p-3 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-gray-700">{trip.trip_number}</p>
                                    <p className="text-xs text-gray-500">{new Date(trip.scheduled_date).toLocaleDateString()}</p>
                                </div>
                                <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded-lg text-xs">DONE</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}
