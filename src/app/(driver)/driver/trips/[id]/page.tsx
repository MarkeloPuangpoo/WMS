"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Link from 'next/link';
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import {
    MapPin,
    Package,
    Navigation,
    Phone,
    CheckCircle2,
    Truck,
    Loader2,
    Camera,
    ArrowLeft,
    Check,
    QrCode
} from "lucide-react";

type TripOrder = {
    id: string;
    order_number: string;
    customer_name: string;
    status: string;
    internal_tracking_number: string;
};

type DeliveryTrip = {
    id: string;
    trip_number: string;
    status: string;
    orders: TripOrder[];
};

export default function ActiveTripPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const supabase = createClient();
    const toast = useToast();
    const { id } = use(params);

    const [trip, setTrip] = useState<DeliveryTrip | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Scanner State
    const [isScanning, setIsScanning] = useState(false);
    const [scannedTracking, setScannedTracking] = useState("");

    // POD State
    const [showPodModal, setShowPodModal] = useState(false);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [isSubmittingPod, setIsSubmittingPod] = useState(false);

    useEffect(() => {
        fetchTripDetails();
    }, [id]);

    const fetchTripDetails = async () => {
        setIsLoading(true);
        try {
            const { data: tripData, error: tripErr } = await supabase
                .from('delivery_trips')
                .select('id, trip_number, status')
                .eq('id', id)
                .single();

            if (tripErr) throw tripErr;

            const { data: ordersData, error: ordersErr } = await supabase
                .from('sales_orders')
                .select('id, order_number, customer_name, status, internal_tracking_number')
                .eq('trip_id', id)
                .order('customer_name', { ascending: true }); // Mock routing order

            if (ordersErr) throw ordersErr;

            setTrip({
                ...tripData,
                orders: ordersData as TripOrder[]
            });

        } catch (error) {
            console.error("Error fetching active trip:", error);
            toast.error("Fetch Failed", "Could not load route data.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleScanResult = (result: string) => {
        setScannedTracking(result);
        setIsScanning(false);

        // Find if this tracking number belongs to any order in this trip
        const matchedOrder = trip?.orders.find(o =>
            // Match internal tracking OR base order number
            o.internal_tracking_number === result || o.order_number === result
        );

        if (matchedOrder) {
            if (matchedOrder.status === 'DELIVERED') {
                toast.warning("Already Delivered", `Order ${matchedOrder.order_number} is already marked complete.`);
            } else {
                toast.success("Match Found", `Arrived at: ${matchedOrder.customer_name}`);
                setActiveOrderId(matchedOrder.id);
                setShowPodModal(true);
            }
        } else {
            toast.error("Not Found", "This barcode does not belong to the current trip.");
            setScannedTracking("");
        }
    };

    const handleSubmitPod = async () => {
        if (!activeOrderId) return;
        setIsSubmittingPod(true);

        try {
            // In a real app, you would upload a photo to Supabase Storage here.
            // For now, we just update the status to DELIVERED.
            const { error } = await supabase
                .from('sales_orders')
                .update({ status: 'DELIVERED' })
                .eq('id', activeOrderId);

            if (error) throw error;

            toast.success("Delivery Successful", "Proof of delivery saved.");

            // Refresh local state to mark it done
            setTrip(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    orders: prev.orders.map(o =>
                        o.id === activeOrderId ? { ...o, status: 'DELIVERED' } : o
                    )
                };
            });

            setShowPodModal(false);
            setActiveOrderId(null);
            setScannedTracking("");

            // Check if all are delivered
            checkTripCompletion();

        } catch (error: any) {
            toast.error("POD Failed", error.message);
        } finally {
            setIsSubmittingPod(false);
        }
    };

    const checkTripCompletion = async () => {
        // We need the freshest data, but we can approx based on our imminent state update
        const remaining = trip?.orders.filter(o => o.status !== 'DELIVERED' && o.id !== activeOrderId);

        if (remaining && remaining.length === 0) {
            // Close the trip
            await supabase
                .from('delivery_trips')
                .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString()
                })
                .eq('id', id);

            toast.success("Route Complete!", "All deliveries finished. Great job!");
            router.push('/driver/trips');
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

    if (!trip) return <div className="p-8 text-center text-red-500">Trip not found.</div>;

    const remainingOrders = trip.orders.filter(o => o.status !== 'DELIVERED');
    const completedOrders = trip.orders.filter(o => o.status === 'DELIVERED');
    const isComplete = remainingOrders.length === 0;

    return (
        <div className="flex flex-col h-[calc(100vh-60px)] relative bg-gray-50">
            {/* Sticky Header info */}
            <div className="bg-white border-b border-gray-200 p-4 shrink-0 flex items-center justify-between z-10">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href="/driver/trips" className="text-gray-400 hover:text-gray-900 pr-2">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h2 className="font-bold text-gray-900 text-lg leading-none">{trip.trip_number}</h2>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {isComplete ? 'COMPLETED' : 'IN PROGRESS'}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium ml-9">
                        {completedOrders.length} / {trip.orders.length} Delivered
                    </p>
                </div>
            </div>

            {/* Scrollable Routing List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {trip.orders.map((order, index) => {
                    const isDelivered = order.status === 'DELIVERED';
                    // We assume the first non-delivered is the "Next Stop"
                    const isNext = !isDelivered && remainingOrders[0]?.id === order.id;

                    return (
                        <div
                            key={order.id}
                            className={`rounded-2xl border p-4 transition-all relative overflow-hidden
                                ${isDelivered ? 'bg-emerald-50/50 border-emerald-100 text-gray-500' : 'bg-white border-gray-200 shadow-sm'}
                                ${isNext ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                            `}
                        >
                            {isNext && (
                                <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                                    NEXT STOP
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-2">
                                <h3 className={`font-bold text-lg leading-tight ${isDelivered ? 'line-through opacity-70' : 'text-gray-900'}`}>
                                    {order.customer_name}
                                </h3>
                                {isDelivered && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                            </div>

                            <p className="text-xs font-mono text-gray-400 mb-3">{order.internal_tracking_number || order.order_number}</p>

                            {!isDelivered && (
                                <div className="flex gap-2 mt-4 border-t border-gray-100 pt-3">
                                    <button className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform">
                                        <Navigation className="w-4 h-4" /> Navigate
                                    </button>
                                    <button className="flex items-center justify-center bg-gray-100 text-gray-700 px-4 py-2 rounded-xl active:scale-95 transition-transform">
                                        <Phone className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}

                {isComplete && (
                    <div className="p-8 text-center bg-emerald-50 rounded-3xl border border-emerald-100">
                        <div className="w-16 h-16 bg-emerald-100 flex items-center justify-center rounded-full mx-auto mb-4">
                            <Check className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h2 className="text-xl font-bold text-emerald-900 mb-2">Great Job!</h2>
                        <p className="text-emerald-700/80 mb-6">You have completed all deliveries on this route.</p>
                        <Link href="/driver/trips" className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-emerald-700">
                            Return Home
                        </Link>
                    </div>
                )}
            </div>

            {/* Floating Scanner Action */}
            {!isComplete && !showPodModal && !isScanning && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-[350px]">
                    <button
                        onClick={() => setIsScanning(true)}
                        className="w-full bg-gray-900 text-white shadow-xl shadow-gray-900/30 rounded-full py-4 px-6 flex items-center justify-center gap-2 font-bold text-lg active:scale-[0.98] transition-all"
                    >
                        <QrCode className="w-6 h-6" />
                        Scan Arrival (POD)
                    </button>
                </div>
            )}

            {/* Scanner Overlay */}
            {isScanning && (
                <BarcodeScanner
                    title="SCAN WAYBILL"
                    description="Point camera at the package tracking code"
                    onScan={handleScanResult}
                    onClose={() => setIsScanning(false)}
                />
            )}

            {/* POD Modal (Proof of Delivery) */}
            {showPodModal && (
                <div className="absolute inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden"></div>

                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                            <MapPin className="w-8 h-8 text-blue-600" />
                        </div>

                        <h3 className="text-xl font-black text-center text-gray-900 mb-1">Arrived at Destination</h3>
                        <p className="text-center text-gray-500 text-sm mb-6">Take a photo to complete Proof of Delivery</p>

                        <div className="bg-gray-50 border border-gray-200 border-dashed rounded-2xl h-48 flex flex-col items-center justify-center text-gray-400 mb-6 cursor-pointer hover:bg-gray-100 transition-colors">
                            <Camera className="w-10 h-10 mb-2" />
                            <span className="font-medium text-sm">Tap to Open Camera</span>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowPodModal(false)}
                                disabled={isSubmittingPod}
                                className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl active:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitPod}
                                disabled={isSubmittingPod}
                                className="flex-1 py-3.5 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700 transition-colors shadow-md flex justify-center items-center gap-2 disabled:opacity-70"
                            >
                                {isSubmittingPod ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Drop-off"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
