"use client";

import React, { useEffect, useState, use } from 'react';
import { Package, MapPin, Phone, Banknote, QrCode, AlertCircle, Loader2, ArrowLeft, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type OrderData = {
    id: string;
    order_number: string;
    customer_name: string;
    status: string;
    internal_tracking_number: string | null;
    created_at: string;
    trip_id: string | null;
    trip?: {
        trip_number: string;
        vehicle: {
            license_plate: string;
        };
        driver: {
            name: string;
            phone: string;
        };
    };
};

export default function DynamicWaybill({ params }: { params: Promise<{ id: string }> }) {
    const supabase = createClient();
    const { id } = use(params);

    const [order, setOrder] = useState<OrderData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchOrderDetails();
    }, [id]);

    const fetchOrderDetails = async () => {
        setIsLoading(true);
        try {
            // Fetch the sales order and try to join with delivery_trips, vehicles, and drivers
            const { data, error: fetchError } = await supabase
                .from('sales_orders')
                .select(`
                    id, 
                    order_number, 
                    customer_name, 
                    status,
                    internal_tracking_number,
                    created_at,
                    trip_id
                `)
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            let tripData = null;

            // If a trip is assigned, manually fetch trip data to avoid complex inner joins crashing if tables don't exist yet
            if (data.trip_id) {
                try {
                    const { data: td } = await supabase
                        .from('delivery_trips')
                        .select(`
                            trip_number,
                            vehicle:vehicles (license_plate),
                            driver:drivers (name, phone)
                        `)
                        .eq('id', data.trip_id)
                        .single();

                    if (td) tripData = td as any;
                } catch (e) {
                    console.log("Could not fetch trip tracking details", e);
                }
            }

            setOrder({ ...data, trip: tripData } as OrderData);

        } catch (err: any) {
            console.error("Waybill fetch error:", err);
            setError(err.message || "Could not load waybill.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-gray-900 mb-2">No Waybill Found</h2>
                    <p className="text-gray-500 mb-6">{error || "This order does not exist."}</p>
                    <Link href="/inventory/outbound" className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium inline-block">
                        Return to Outbound
                    </Link>
                </div>
            </div>
        );
    }

    // Default Fallbacks
    const trackingNo = order.internal_tracking_number || `CLM-WEB-${order.order_number.split('-').pop()}`;
    const vehiclePlate = order.trip?.vehicle?.license_plate || "UNASSIGNED";
    const driverName = order.trip?.driver?.name || "Pending Dispatch";

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-8 flex justify-center items-start font-sans">

            {/* Action Bar (Hidden when printing via @media print in globals.css) */}
            <div className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white p-2 pr-4 rounded-full shadow-lg border border-gray-200 z-50 animate-in slide-in-from-top-4 print:hidden">
                <Link href="/inventory/outbound" className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="h-6 w-px bg-gray-200"></div>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-bold shadow-sm transition-all active:scale-95"
                >
                    <Printer className="w-4 h-4" />
                    Print Waybill
                </button>
            </div>

            {/* A6 Dimension Container for Print */}
            <div className="w-[10cm] h-auto min-h-[15cm] bg-white border-2 border-black p-4 text-black shadow-2xl mt-16 print:mt-0 print:border-none print:shadow-none">

                {/* Header: Logo and Zone */}
                <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-3">
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter">COLAMARC</h1>
                        <p className="text-[10px] font-bold text-gray-600">IN-HOUSE LOGISTICS</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-bold uppercase mb-0.5">Fleet Veh.</p>
                        <div className="bg-black text-white px-2 py-0.5 text-xl font-black rounded-sm whitespace-nowrap overflow-hidden max-w-[100px]">
                            {vehiclePlate}
                        </div>
                    </div>
                </div>

                {/* Tracking & Barcode */}
                <div className="text-center mb-4">
                    <div className="w-full h-14 bg-gray-100 flex items-center justify-center border border-dashed border-gray-400 mb-1 rounded-sm">
                        <span className="text-gray-500 text-sm font-mono tracking-wider">* {trackingNo} *</span>
                    </div>
                    <p className="font-mono font-bold text-lg tracking-widest leading-none">{trackingNo}</p>
                </div>

                {/* Receiver Info */}
                <div className="border-2 border-black rounded-lg p-3 mb-4 flex flex-col justify-center min-h-[140px]">
                    <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-5 h-5" />
                        <h2 className="font-bold text-lg">ผู้รับ (Receiver)</h2>
                    </div>
                    <p className="font-bold text-xl mb-2 leading-tight">{order.customer_name}</p>
                    <div className="flex items-center gap-2 mb-2 bg-yellow-100 p-1 px-2 w-fit rounded border border-yellow-200">
                        <Phone className="w-4 h-4 shrink-0" />
                        <p className="font-bold text-lg tracking-wide">08X-XXX-XXXX</p>
                    </div>
                    <p className="text-xs leading-relaxed text-gray-700 line-clamp-3">
                        (Contact details are suppressed in demo mode. Assume full address is printed here.)<br />
                        Bangkok, 10110
                    </p>
                </div>

                {/* Payment Detail */}
                <div className="flex gap-2 mb-4">
                    <div className="flex-1 border-2 border-black p-2 rounded-lg text-center bg-gray-50">
                        <p className="text-[10px] font-bold text-gray-500 mb-0.5">ประเภทชำระเงิน</p>
                        <h3 className="font-black text-xl text-green-600 leading-none mb-1">PAID</h3>
                        <p className="text-[9px] text-gray-500 leading-tight">(จ่ายแล้ว)</p>
                    </div>
                    <div className="flex-1 border-2 border-black p-2 rounded-lg text-center">
                        <p className="text-[10px] font-bold text-gray-500 mb-0.5">เก็บปลายทาง (COD)</p>
                        <h3 className="font-black text-xl leading-none mb-1">-</h3>
                        <p className="text-[9px] text-gray-500 leading-tight">THB</p>
                    </div>
                </div>

                {/* Order Meta & Scan Box */}
                <div className="flex justify-between items-end border-t-2 border-black pt-3">
                    <div className="text-[10px] space-y-1 w-[60%]">
                        <p><b>Order:</b> {order.order_number}</p>
                        <p><b>Print Date:</b> {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="truncate"><b>Driver:</b> {driverName}</p>
                        <div className="mt-2 pt-2 border-t border-gray-300">
                            <p className="font-bold text-[#b91c1c] uppercase text-xs">** ถ่ายรูปหน้าบ้าน **</p>
                        </div>
                    </div>

                    {/* QR Code for Driver App */}
                    <div className="text-center flex flex-col items-center">
                        <div className="w-16 h-16 border-2 border-black p-1 flex justify-center items-center bg-gray-50">
                            <QrCode className="w-full h-full text-black" />
                        </div>
                        <p className="text-[9px] font-bold mt-1 uppercase tracking-tight">Driver Scan</p>
                    </div>
                </div>

            </div>
        </div>
    );
}
